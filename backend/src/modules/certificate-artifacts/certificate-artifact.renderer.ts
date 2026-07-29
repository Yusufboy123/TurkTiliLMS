import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import type { Readable } from 'node:stream';
import {
  CERTIFICATE_PDF_MIME_TYPE,
  CERTIFICATE_RENDERER_IDENTIFIER,
  CERTIFICATE_RENDERER_VERSION,
  PDFKIT_PACKAGE_VERSION,
} from './certificate-artifact.constants.js';
import { artifactTooLarge, renderFailed, renderTimeout } from './certificate-artifact.errors.js';
import type { CertificateArtifactError } from './certificate-artifact.errors.js';
import { validateCertificatePdf } from './certificate-artifact.integrity.js';
import type {
  CertificateFontManifest,
  CertificateFontSource,
  CertificateRenderInput,
  CertificateRenderedPdf,
  CertificateRenderer,
} from './certificate-artifact.types.js';

const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const PAGE_MARGIN = 42;
const BRAND_RED = '#B91C1C';
const BRAND_DARK_RED = '#7F1D1D';
const TEXT_PRIMARY = '#1F2937';
const TEXT_MUTED = '#4B5563';
const SURFACE = '#FFFFFF';
const SOFT_SURFACE = '#FEF2F2';
const FONT_REGULAR = 'NotoSansRegular';
const FONT_BOLD = 'NotoSansBold';
const UZBEK_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
] as const;
const require = createRequire(import.meta.url);
const pdfKitPackage = require('pdfkit/package.json') as { version?: unknown };

function formatUzbekDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const monthName = month === undefined ? undefined : UZBEK_MONTHS[month - 1];
  if (year === undefined || monthName === undefined || day === undefined) {
    throw renderFailed();
  }
  return `${day}-${monthName}, ${year}`;
}

function drawCertificate(document: PDFKit.PDFDocument, input: CertificateRenderInput): void {
  document.addPage({
    size: [A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT],
    margin: 0,
  });

  document.rect(0, 0, A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT).fill(SURFACE);
  document
    .roundedRect(
      PAGE_MARGIN,
      PAGE_MARGIN,
      A4_LANDSCAPE_WIDTH - PAGE_MARGIN * 2,
      A4_LANDSCAPE_HEIGHT - PAGE_MARGIN * 2,
      8,
    )
    .lineWidth(4)
    .strokeColor(BRAND_RED)
    .stroke();
  document
    .roundedRect(
      PAGE_MARGIN + 10,
      PAGE_MARGIN + 10,
      A4_LANDSCAPE_WIDTH - (PAGE_MARGIN + 10) * 2,
      A4_LANDSCAPE_HEIGHT - (PAGE_MARGIN + 10) * 2,
      5,
    )
    .lineWidth(1)
    .strokeColor(BRAND_DARK_RED)
    .stroke();

  document
    .font(FONT_BOLD)
    .fontSize(15)
    .fillColor(BRAND_DARK_RED)
    .text('TURK TILI LMS', PAGE_MARGIN + 40, 78, {
      width: A4_LANDSCAPE_WIDTH - (PAGE_MARGIN + 40) * 2,
      align: 'center',
      lineBreak: false,
    });

  document
    .font(FONT_BOLD)
    .fontSize(34)
    .fillColor(BRAND_RED)
    .text('SERTIFIKAT', PAGE_MARGIN + 60, 118, {
      width: A4_LANDSCAPE_WIDTH - (PAGE_MARGIN + 60) * 2,
      align: 'center',
      lineBreak: false,
    });

  document
    .font(FONT_REGULAR)
    .fontSize(13)
    .fillColor(TEXT_MUTED)
    .text('Ushbu sertifikat quyidagi tinglovchiga taqdim etiladi:', 115, 178, {
      width: A4_LANDSCAPE_WIDTH - 230,
      align: 'center',
      lineBreak: false,
    });

  document
    .font(FONT_BOLD)
    .fontSize(28)
    .fillColor(TEXT_PRIMARY)
    .text(input.recipientDisplayName, 100, 215, {
      width: A4_LANDSCAPE_WIDTH - 200,
      align: 'center',
      height: 45,
      ellipsis: true,
    });

  document
    .moveTo(180, 265)
    .lineTo(A4_LANDSCAPE_WIDTH - 180, 265)
    .lineWidth(1.2)
    .strokeColor(BRAND_RED)
    .stroke();

  document
    .font(FONT_REGULAR)
    .fontSize(13)
    .fillColor(TEXT_MUTED)
    .text('quyidagi kursni muvaffaqiyatli yakunlagani uchun:', 115, 286, {
      width: A4_LANDSCAPE_WIDTH - 230,
      align: 'center',
      lineBreak: false,
    });

  document
    .font(FONT_BOLD)
    .fontSize(21)
    .fillColor(TEXT_PRIMARY)
    .text(input.courseTitle, 105, 320, {
      width: A4_LANDSCAPE_WIDTH - 210,
      align: 'center',
      height: 58,
      ellipsis: true,
    });

  document
    .roundedRect(92, 395, A4_LANDSCAPE_WIDTH - 184, 72, 4)
    .fillColor(SOFT_SURFACE)
    .fill();

  document
    .font(FONT_REGULAR)
    .fontSize(10)
    .fillColor(TEXT_MUTED)
    .text(`Yakunlangan sana: ${formatUzbekDate(input.completionDate)}`, 112, 412, {
      width: 260,
      lineBreak: false,
    })
    .text(`Berilgan sana: ${formatUzbekDate(input.issueDate)}`, 112, 438, {
      width: 260,
      lineBreak: false,
    });

  const signatory = [input.signatoryName, input.signatoryTitle].filter(Boolean).join(' — ');
  document
    .font(FONT_REGULAR)
    .fontSize(10)
    .fillColor(TEXT_MUTED)
    .text(input.organizationName, 430, 412, {
      width: 290,
      height: 15,
      align: 'right',
      ellipsis: true,
    })
    .text(signatory || 'Vakolatli tashkilot', 430, 438, {
      width: 290,
      height: 15,
      align: 'right',
      ellipsis: true,
    });

  document
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(BRAND_DARK_RED)
    .text(`Sertifikat raqami: ${input.certificateNumber}`, 92, 500, {
      width: 330,
      lineBreak: false,
    });
  document
    .font(FONT_REGULAR)
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(
      `Shablon: ${input.templateCode} v${input.templateVersion} · ${input.rendererContractVersion}`,
      420,
      500,
      {
        width: 330,
        align: 'right',
        lineBreak: false,
      },
    );
}

export function collectBoundedPdfStream(
  stream: Readable,
  timeoutMs: number,
  maximumSizeBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let sizeBytes = 0;
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timeout);
      stream.off('data', handleData);
      stream.off('end', handleEnd);
      stream.off('error', handleError);
    };

    const fail = (error: CertificateArtifactError): void => {
      if (settled) return;
      settled = true;
      cleanup();
      stream.destroy();
      reject(error);
    };

    const handleData = (chunk: Buffer | Uint8Array | string): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += buffer.length;
      if (sizeBytes > maximumSizeBytes) {
        fail(artifactTooLarge(maximumSizeBytes));
        return;
      }
      chunks.push(buffer);
    };

    const handleEnd = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, sizeBytes));
    };

    const handleError = (): void => {
      fail(renderFailed());
    };

    const timeout = setTimeout(() => {
      fail(renderTimeout());
    }, timeoutMs);
    timeout.unref();

    stream.on('data', handleData);
    stream.once('end', handleEnd);
    stream.once('error', handleError);
  });
}

export class PdfKitCertificateRenderer implements CertificateRenderer {
  readonly identifier = CERTIFICATE_RENDERER_IDENTIFIER;
  readonly version = CERTIFICATE_RENDERER_VERSION;

  constructor(
    private readonly fontSource: CertificateFontSource,
    private readonly timeoutMs: number,
    private readonly maximumSizeBytes: number,
  ) {}

  async fontManifest(): Promise<CertificateFontManifest> {
    return (await this.fontSource.load()).manifest;
  }

  async render(input: CertificateRenderInput): Promise<CertificateRenderedPdf> {
    if (pdfKitPackage.version !== PDFKIT_PACKAGE_VERSION) throw renderFailed();
    const fonts = await this.fontSource.load();
    const controlledTimestamp = new Date(input.issuedAt);
    const document = new PDFDocument({
      autoFirstPage: false,
      bufferPages: false,
      compress: true,
      displayTitle: true,
      info: {
        Title: `Turk Tili LMS sertifikati ${input.certificateNumber}`,
        Author: input.organizationName,
        Subject: 'Turk tili kursini yakunlash sertifikati',
        Creator: CERTIFICATE_RENDERER_IDENTIFIER,
        Producer: CERTIFICATE_RENDERER_VERSION,
        CreationDate: controlledTimestamp,
        ModDate: controlledTimestamp,
      },
      lang: input.locale,
      pdfVersion: '1.7',
    });
    const output = collectBoundedPdfStream(document, this.timeoutMs, this.maximumSizeBytes);

    try {
      document.registerFont(FONT_REGULAR, fonts.regular);
      document.registerFont(FONT_BOLD, fonts.bold);
      drawCertificate(document, input);
      document.end();
    } catch (error: unknown) {
      document.destroy(error instanceof Error ? error : new Error('PDF rendering failed.'));
    }

    const bytes = await output;
    validateCertificatePdf(bytes, CERTIFICATE_PDF_MIME_TYPE, this.maximumSizeBytes);

    return Object.freeze({
      bytes,
      mimeType: CERTIFICATE_PDF_MIME_TYPE,
      sizeBytes: bytes.length,
      rendererIdentifier: this.identifier,
      rendererVersion: this.version,
    });
  }
}
