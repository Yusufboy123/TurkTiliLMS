import { createHash, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  CERTIFICATE_PDF_MIME_TYPE,
  CERTIFICATE_PDF_MAX_CONTRACT_BYTES,
} from './certificate-artifact.constants.js';
import {
  artifactIntegrityFailed,
  artifactTooLarge,
  invalidPdfOutput,
} from './certificate-artifact.errors.js';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const PDF_END_MARKER = Buffer.from('%%EOF', 'ascii');
const PDF_XREF_MARKER = Buffer.from('xref', 'ascii');
const PDF_TRAILER_PATTERN = /startxref\s+(\d+)\s*$/u;

function isPdfTrailingWhitespace(byte: number): boolean {
  return byte === 0 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 32;
}

function validatePdfTrailer(bytes: Buffer): void {
  let meaningfulEnd = bytes.length;
  while (meaningfulEnd > 0 && isPdfTrailingWhitespace(bytes[meaningfulEnd - 1] ?? -1)) {
    meaningfulEnd -= 1;
  }

  const eofStart = meaningfulEnd - PDF_END_MARKER.length;
  if (eofStart < 0 || !bytes.subarray(eofStart, meaningfulEnd).equals(PDF_END_MARKER)) {
    throw invalidPdfOutput();
  }

  const trailerStart = Math.max(PDF_SIGNATURE.length, eofStart - 256);
  const trailer = bytes.subarray(trailerStart, eofStart).toString('ascii');
  const match = PDF_TRAILER_PATTERN.exec(trailer);
  const xrefOffset = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  if (
    !Number.isSafeInteger(xrefOffset) ||
    xrefOffset < PDF_SIGNATURE.length ||
    xrefOffset >= trailerStart + trailer.length ||
    !bytes.subarray(xrefOffset, xrefOffset + PDF_XREF_MARKER.length).equals(PDF_XREF_MARKER)
  ) {
    throw invalidPdfOutput();
  }
}

export function calculateSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

interface ConsumedStream {
  readonly checksum: string;
  readonly sizeBytes: number;
  readonly bytes?: Buffer;
}

async function consumeBoundedStream(
  stream: Readable,
  maximumSizeBytes: number,
  collectBytes: boolean,
): Promise<ConsumedStream> {
  const hash = createHash('sha256');
  const chunks: Buffer[] = [];
  let sizeBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    sizeBytes += buffer.length;
    if (sizeBytes > maximumSizeBytes) {
      stream.destroy();
      throw artifactTooLarge(maximumSizeBytes);
    }
    hash.update(buffer);
    if (collectBytes) chunks.push(buffer);
  }

  return {
    checksum: hash.digest('hex'),
    sizeBytes,
    ...(collectBytes ? { bytes: Buffer.concat(chunks, sizeBytes) } : {}),
  };
}

export function validateCertificatePdf(
  bytes: Buffer,
  mimeType: string,
  maximumSizeBytes: number = CERTIFICATE_PDF_MAX_CONTRACT_BYTES,
): void {
  if (mimeType !== CERTIFICATE_PDF_MIME_TYPE || bytes.length === 0) {
    throw invalidPdfOutput();
  }

  if (bytes.length > maximumSizeBytes) {
    throw artifactTooLarge(maximumSizeBytes);
  }

  if (!bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw invalidPdfOutput();
  }

  validatePdfTrailer(bytes);
}

export async function calculateStreamSha256(
  stream: Readable,
  maximumSizeBytes: number = CERTIFICATE_PDF_MAX_CONTRACT_BYTES,
): Promise<{ checksum: string; sizeBytes: number }> {
  return consumeBoundedStream(stream, maximumSizeBytes, false);
}

export async function collectVerifiedStreamBytes(
  stream: Readable,
  maximumSizeBytes: number = CERTIFICATE_PDF_MAX_CONTRACT_BYTES,
): Promise<{ bytes: Buffer; checksum: string; sizeBytes: number }> {
  const consumed = await consumeBoundedStream(stream, maximumSizeBytes, true);
  if (!consumed.bytes) throw artifactIntegrityFailed();
  return {
    bytes: consumed.bytes,
    checksum: consumed.checksum,
    sizeBytes: consumed.sizeBytes,
  };
}

export function assertMatchingChecksum(actual: string, expected: string): void {
  if (!/^[0-9a-f]{64}$/u.test(actual) || !/^[0-9a-f]{64}$/u.test(expected)) {
    throw artifactIntegrityFailed();
  }

  if (!timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))) {
    throw artifactIntegrityFailed();
  }
}
