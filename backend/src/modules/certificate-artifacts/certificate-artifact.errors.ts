import { AppError } from '../../utils/app-error.js';

export type CertificateArtifactFailureCategory =
  | 'INVALID_RENDER_INPUT'
  | 'UNSUPPORTED_LOCALE'
  | 'UNSUPPORTED_TEMPLATE'
  | 'FONT_ASSET_UNAVAILABLE'
  | 'FONT_ASSET_MISMATCH'
  | 'RENDER_TIMEOUT'
  | 'RENDER_FAILED'
  | 'INVALID_PDF_OUTPUT'
  | 'ARTIFACT_TOO_LARGE'
  | 'STAGING_FAILED'
  | 'FINALIZATION_FAILED'
  | 'STORAGE_COLLISION'
  | 'CERTIFICATE_NOT_FOUND'
  | 'ARTIFACT_ALREADY_EXISTS'
  | 'PERSISTENCE_FAILED'
  | 'COMPENSATION_FAILED'
  | 'ARTIFACT_NOT_FOUND'
  | 'ARTIFACT_INTEGRITY_FAILED';

export class CertificateArtifactError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: string,
    readonly category: CertificateArtifactFailureCategory,
    details?: unknown,
  ) {
    super(message, statusCode, code, details);
    this.name = 'CertificateArtifactError';
  }
}

export function invalidRenderInput(details?: unknown): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat yaratish ma’lumotlari noto‘g‘ri.',
    422,
    'CERTIFICATE_RENDER_INPUT_INVALID',
    'INVALID_RENDER_INPUT',
    details,
  );
}

export function unsupportedLocale(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat tili qo‘llab-quvvatlanmaydi.',
    422,
    'CERTIFICATE_RENDER_LOCALE_UNSUPPORTED',
    'UNSUPPORTED_LOCALE',
  );
}

export function unsupportedTemplate(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat shabloni renderer bilan mos emas.',
    409,
    'CERTIFICATE_TEMPLATE_UNSUPPORTED',
    'UNSUPPORTED_TEMPLATE',
  );
}

export function fontAssetUnavailable(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat shrift resurslari mavjud emas.',
    503,
    'CERTIFICATE_FONT_ASSET_UNAVAILABLE',
    'FONT_ASSET_UNAVAILABLE',
  );
}

export function fontAssetMismatch(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat shrift resurslari tasdiqlangan versiyaga mos emas.',
    409,
    'CERTIFICATE_FONT_ASSET_MISMATCH',
    'FONT_ASSET_MISMATCH',
  );
}

export function renderTimeout(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat PDF faylini yaratish vaqti tugadi.',
    503,
    'CERTIFICATE_PDF_RENDER_TIMEOUT',
    'RENDER_TIMEOUT',
  );
}

export function renderFailed(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat PDF faylini yaratib bo‘lmadi.',
    503,
    'CERTIFICATE_PDF_RENDER_FAILED',
    'RENDER_FAILED',
  );
}

export function invalidPdfOutput(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Yaratilgan sertifikat PDF formati noto‘g‘ri.',
    500,
    'CERTIFICATE_PDF_OUTPUT_INVALID',
    'INVALID_PDF_OUTPUT',
  );
}

export function artifactTooLarge(maximumSizeBytes: number): CertificateArtifactError {
  return new CertificateArtifactError(
    'Yaratilgan sertifikat fayli ruxsat etilgan hajmdan katta.',
    413,
    'CERTIFICATE_ARTIFACT_TOO_LARGE',
    'ARTIFACT_TOO_LARGE',
    { maximumSizeBytes },
  );
}

export function stagingFailed(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat faylini vaqtincha saqlab bo‘lmadi.',
    503,
    'CERTIFICATE_ARTIFACT_STAGING_FAILED',
    'STAGING_FAILED',
  );
}

export function finalizationFailed(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat faylini yakuniy saqlab bo‘lmadi.',
    503,
    'CERTIFICATE_ARTIFACT_STORAGE_FAILED',
    'FINALIZATION_FAILED',
  );
}

export function storageCollision(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat saqlash identifikatori bilan ziddiyat yuz berdi.',
    409,
    'CERTIFICATE_ARTIFACT_STORAGE_COLLISION',
    'STORAGE_COLLISION',
  );
}

export function certificateNotFound(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat topilmadi.',
    404,
    'CERTIFICATE_NOT_FOUND',
    'CERTIFICATE_NOT_FOUND',
  );
}

export function artifactAlreadyExists(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat uchun yakuniy fayl allaqachon mavjud.',
    409,
    'CERTIFICATE_ARTIFACT_ALREADY_EXISTS',
    'ARTIFACT_ALREADY_EXISTS',
  );
}

export function persistenceFailed(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat fayli metama’lumotlarini saqlab bo‘lmadi.',
    500,
    'CERTIFICATE_ARTIFACT_PERSISTENCE_FAILED',
    'PERSISTENCE_FAILED',
  );
}

export function compensationFailed(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat fayli xatosidan keyingi tozalash to‘liq bajarilmadi.',
    500,
    'CERTIFICATE_ARTIFACT_COMPENSATION_FAILED',
    'COMPENSATION_FAILED',
  );
}

export function artifactNotFound(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat fayli topilmadi.',
    404,
    'CERTIFICATE_ARTIFACT_NOT_FOUND',
    'ARTIFACT_NOT_FOUND',
  );
}

export function artifactIntegrityFailed(): CertificateArtifactError {
  return new CertificateArtifactError(
    'Sertifikat faylining yaxlitligi tasdiqlanmadi.',
    503,
    'CERTIFICATE_ARTIFACT_UNAVAILABLE',
    'ARTIFACT_INTEGRITY_FAILED',
  );
}
