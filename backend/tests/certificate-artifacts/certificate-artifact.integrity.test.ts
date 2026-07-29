import { Readable } from 'node:stream';
import {
  assertMatchingChecksum,
  calculateSha256,
  calculateStreamSha256,
  collectVerifiedStreamBytes,
  validateCertificatePdf,
} from '../../src/modules/certificate-artifacts/certificate-artifact.integrity.js';
import { PDF_BYTES } from '../helpers/certificate-artifact-fakes.js';

describe('certificate PDF integrity', () => {
  it('calculates lowercase SHA-256 from actual bytes', () => {
    const checksum = calculateSha256(PDF_BYTES);

    expect(checksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(calculateSha256(Buffer.concat([PDF_BYTES, Buffer.from('changed')]))).not.toBe(checksum);
  });

  it('validates signature, MIME type, size, and end marker', () => {
    expect(() => validateCertificatePdf(PDF_BYTES, 'application/pdf', 1_000)).not.toThrow();
    expect(() => validateCertificatePdf(Buffer.alloc(0), 'application/pdf', 1_000)).toThrow();
    expect(() =>
      validateCertificatePdf(Buffer.from('not-pdf'), 'application/pdf', 1_000),
    ).toThrow();
    expect(() => validateCertificatePdf(PDF_BYTES, 'text/plain', 1_000)).toThrow();
    expect(() =>
      validateCertificatePdf(Buffer.from('%PDF-1.7\nmissing-end'), 'application/pdf', 1_000),
    ).toThrow();
    expect(() =>
      validateCertificatePdf(
        Buffer.from('%PDF-1.7\nobviously-truncated\n%%EOF\n'),
        'application/pdf',
        1_000,
      ),
    ).toThrow();
    expect(() =>
      validateCertificatePdf(
        Buffer.concat([PDF_BYTES, Buffer.from(' \r\n\t')]),
        'application/pdf',
        1_000,
      ),
    ).not.toThrow();
    expect(() => validateCertificatePdf(PDF_BYTES, 'application/pdf', 4)).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_ARTIFACT_TOO_LARGE' }),
    );
  });

  it('calculates bounded stream integrity and rejects oversized streams', async () => {
    await expect(calculateStreamSha256(Readable.from(PDF_BYTES), 1_000)).resolves.toEqual({
      checksum: calculateSha256(PDF_BYTES),
      sizeBytes: PDF_BYTES.length,
    });
    await expect(calculateStreamSha256(Readable.from(Buffer.alloc(11)), 10)).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_TOO_LARGE',
    });
    await expect(collectVerifiedStreamBytes(Readable.from(PDF_BYTES), 1_000)).resolves.toEqual({
      bytes: PDF_BYTES,
      checksum: calculateSha256(PDF_BYTES),
      sizeBytes: PDF_BYTES.length,
    });
  });

  it('uses normalized timing-safe checksum comparison', () => {
    const checksum = calculateSha256(PDF_BYTES);
    expect(() => assertMatchingChecksum(checksum, checksum)).not.toThrow();
    expect(() => assertMatchingChecksum(checksum, 'a'.repeat(64))).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_ARTIFACT_UNAVAILABLE' }),
    );
    expect(() => assertMatchingChecksum(checksum, 'INVALID')).toThrow();
  });
});
