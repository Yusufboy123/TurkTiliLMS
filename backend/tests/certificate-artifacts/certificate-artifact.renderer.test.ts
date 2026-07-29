import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import {
  CERTIFICATE_PDF_MIME_TYPE,
  CERTIFICATE_RENDERER_IDENTIFIER,
  CERTIFICATE_RENDERER_VERSION,
  NOTO_SANS_FAMILY,
  NOTO_SANS_LICENSE_IDENTIFIER,
  NOTO_SANS_PACKAGE_VERSION,
  PDFKIT_PACKAGE_VERSION,
} from '../../src/modules/certificate-artifacts/certificate-artifact.constants.js';
import { PackageNotoSansFontSource } from '../../src/modules/certificate-artifacts/certificate-font-source.js';
import {
  PdfKitCertificateRenderer,
  collectBoundedPdfStream,
} from '../../src/modules/certificate-artifacts/certificate-artifact.renderer.js';
import { normalizeCertificateRenderInput } from '../../src/modules/certificate-artifacts/certificate-render-input.js';
import { renderInput } from '../helpers/certificate-artifact-fakes.js';

function decodeUtf16Hex(value: string): string {
  const compact = value.replace(/\s+/gu, '');
  let decoded = '';
  for (let index = 0; index < compact.length; index += 4) {
    decoded += String.fromCharCode(Number.parseInt(compact.slice(index, index + 4), 16));
  }
  return decoded;
}

function extractPdfText(pdf: Buffer): string[] {
  const source = pdf.toString('latin1');
  const inflatedStreams: string[] = [];
  let cursor = 0;
  while (true) {
    const streamStart = source.indexOf('stream\n', cursor);
    if (streamStart < 0) break;
    const dataStart = streamStart + 'stream\n'.length;
    const streamEnd = source.indexOf('\nendstream', dataStart);
    if (streamEnd < 0) break;
    try {
      inflatedStreams.push(inflateSync(pdf.subarray(dataStart, streamEnd)).toString('latin1'));
    } catch {
      // Non-Flate streams are irrelevant to this PDFKit text-extraction assertion.
    }
    cursor = streamEnd + '\nendstream'.length;
  }

  const maps = inflatedStreams.flatMap((stream) =>
    [
      ...stream.matchAll(
        /<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4})>\s*\[((?:\s*<[0-9A-Fa-f\s]+>)+)\]/gu,
      ),
    ].map((match) => {
      const start = Number.parseInt(match[1]!, 16);
      const mapping = new Map<number, string>();
      [...match[3]!.matchAll(/<([0-9A-Fa-f\s]+)>/gu)].forEach((value, index) => {
        mapping.set(start + index, decodeUtf16Hex(value[1]!));
      });
      return mapping;
    }),
  );

  return inflatedStreams.flatMap((stream) =>
    [...stream.matchAll(/\[((?:.|\n)*?)\]\s*TJ/gu)].flatMap((textArray) => {
      const glyphRuns = [...textArray[1]!.matchAll(/<([0-9A-Fa-f]+)>/gu)].map((match) => match[1]!);
      return maps.map((mapping) =>
        glyphRuns
          .map((glyphRun) => {
            let decoded = '';
            for (let index = 0; index < glyphRun.length; index += 4) {
              decoded += mapping.get(Number.parseInt(glyphRun.slice(index, index + 4), 16)) ?? '';
            }
            return decoded;
          })
          .join(''),
      );
    }),
  );
}

describe('PdfKitCertificateRenderer', () => {
  const require = createRequire(import.meta.url);
  const maximumSizeBytes = 10_485_760;
  const renderer = new PdfKitCertificateRenderer(
    new PackageNotoSansFontSource(),
    10_000,
    maximumSizeBytes,
  );

  it('renders a bounded valid PDF using the approved local font source', async () => {
    const result = await renderer.render(
      normalizeCertificateRenderInput({
        ...renderInput(),
        recipientDisplayName: 'O‘zbek Öğrenci — Ўқувчи',
        courseTitle: 'Türkçe: ı İ ş Ş ğ Ğ ç Ç ö Ö ü Ü',
      }),
    );
    const manifest = await renderer.fontManifest();

    expect(result.mimeType).toBe(CERTIFICATE_PDF_MIME_TYPE);
    expect(result.rendererIdentifier).toBe(CERTIFICATE_RENDERER_IDENTIFIER);
    expect(result.rendererVersion).toBe(CERTIFICATE_RENDERER_VERSION);
    expect(result.sizeBytes).toBe(result.bytes.length);
    expect(result.sizeBytes).toBeGreaterThan(1_000);
    expect(result.sizeBytes).toBeLessThan(maximumSizeBytes);
    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.bytes.subarray(-16).toString('ascii')).toContain('%%EOF');
    expect(manifest).toMatchObject({
      family: NOTO_SANS_FAMILY,
      version: NOTO_SANS_PACKAGE_VERSION,
      licenseIdentifier: NOTO_SANS_LICENSE_IDENTIFIER,
      checksum: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
  });

  it('pins reported provenance to the actual installed renderer and font packages', () => {
    expect((require('pdfkit/package.json') as { version: string }).version).toBe(
      PDFKIT_PACKAGE_VERSION,
    );
    expect(
      (require('@expo-google-fonts/noto-sans/package.json') as { version: string }).version,
    ).toBe(NOTO_SANS_PACKAGE_VERSION);
  });

  it('produces byte-identical output for the same controlled input and assets', async () => {
    const input = normalizeCertificateRenderInput(renderInput());
    const first = await renderer.render(input);
    const second = await renderer.render(input);

    expect(second.bytes.equals(first.bytes)).toBe(true);
  });

  it('draws markup-shaped values as inert text without HTML or browser rendering', async () => {
    const result = await renderer.render(
      normalizeCertificateRenderInput({
        ...renderInput(),
        recipientDisplayName: '<script>alert(1)</script>',
      }),
    );

    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('renders the raw verification capability only as trusted plain text', async () => {
    const verificationIdentifier = 'V'.repeat(43);
    const result = await renderer.render(
      normalizeCertificateRenderInput(renderInput({ verificationIdentifier })),
    );
    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(extractPdfText(result.bytes)).toContain(
      `Tekshirish identifikatori: ${verificationIdentifier}`,
    );
  });
});

describe('collectBoundedPdfStream', () => {
  it('rejects and destroys a stream that exceeds the byte limit', async () => {
    const stream = new PassThrough();
    const collected = collectBoundedPdfStream(stream, 1_000, 4);
    stream.write(Buffer.from('12345'));

    await expect(collected).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_TOO_LARGE',
    });
    expect(stream.destroyed).toBe(true);
  });

  it('maps stream errors to a safe renderer failure', async () => {
    const stream = new PassThrough();
    const collected = collectBoundedPdfStream(stream, 1_000, 100);
    stream.destroy(new Error('private low-level failure'));

    await expect(collected).rejects.toMatchObject({
      code: 'CERTIFICATE_PDF_RENDER_FAILED',
      message: expect.not.stringContaining('private low-level failure'),
    });
  });

  it('times out and disposes a stalled stream', async () => {
    const stream = new PassThrough();
    const collected = collectBoundedPdfStream(stream, 10, 100);

    await expect(collected).rejects.toMatchObject({
      code: 'CERTIFICATE_PDF_RENDER_TIMEOUT',
    });
    expect(stream.destroyed).toBe(true);
  });
});
