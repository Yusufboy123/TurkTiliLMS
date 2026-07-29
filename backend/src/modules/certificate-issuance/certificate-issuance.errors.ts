import { AppError } from '../../utils/app-error.js';

function error(message: string, statusCode: number, code: string): AppError {
  return new AppError(message, statusCode, code);
}

export const certificateAccessDenied = (): AppError =>
  error('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
export const certificateCourseScopeDenied = (): AppError =>
  error('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
export const certificateEnrollmentNotFound = (): AppError =>
  error('Kursga yozilish ma\u2018lumoti topilmadi.', 404, 'ENROLLMENT_NOT_FOUND');
export const certificateNotFound = (): AppError =>
  error('Sertifikat topilmadi.', 404, 'CERTIFICATE_NOT_FOUND');
export const certificateVerificationNotFound = (): AppError =>
  error(
    'Sertifikatni tasdiqlash ma\u2018lumoti topilmadi.',
    404,
    'CERTIFICATE_VERIFICATION_NOT_FOUND',
  );
export const certificateEvidenceConflict = (): AppError =>
  error(
    'Sertifikat dalillari joriy yakunlash ma\u2018lumotiga mos emas.',
    409,
    'CERTIFICATE_EVIDENCE_CONFLICT',
  );
export const certificateAlreadyIssued = (): AppError =>
  error(
    'Bu kurs yoziluvi uchun sertifikat allaqachon berilgan.',
    409,
    'CERTIFICATE_ALREADY_ISSUED',
  );
export const certificateIssuanceConflict = (): AppError =>
  error(
    'Sertifikat berish amali xavfsiz yakunlanmadi. Qayta urinib ko\u2018ring.',
    409,
    'CERTIFICATE_ISSUANCE_CONFLICT',
  );
export const certificateNumberingConflict = (): AppError =>
  error(
    'Sertifikat raqamini xavfsiz ajratib bo\u2018lmadi.',
    409,
    'CERTIFICATE_NUMBERING_CONFLICT',
  );
export const idempotencyKeyReused = (): AppError =>
  error(
    'Bu takrorlanmas so\u2018rov kaliti boshqa amal uchun ishlatilgan.',
    409,
    'IDEMPOTENCY_KEY_REUSED',
  );
export const certificateNotEligible = (): AppError =>
  error(
    'Bu kurs bo\u2018yicha sertifikat olish shartlari bajarilmagan.',
    422,
    'CERTIFICATE_NOT_ELIGIBLE',
  );
export const certificateTemplateUnavailable = (): AppError =>
  error('Mos sertifikat shabloni hozir mavjud emas.', 422, 'CERTIFICATE_TEMPLATE_UNAVAILABLE');
export const certificateArtifactGenerationFailed = (): AppError =>
  error('Sertifikat faylini yaratib bo\u2018lmadi.', 424, 'CERTIFICATE_ARTIFACT_GENERATION_FAILED');
export const certificateArtifactStorageFailed = (): AppError =>
  error(
    'Sertifikat faylini xavfsiz saqlab bo\u2018lmadi.',
    424,
    'CERTIFICATE_ARTIFACT_STORAGE_FAILED',
  );
export const certificateArtifactUnavailable = (): AppError =>
  error('Sertifikat fayli hozir mavjud emas.', 424, 'CERTIFICATE_ARTIFACT_UNAVAILABLE');
export const certificateRevoked = (): AppError =>
  error('Bekor qilingan sertifikatni yuklab bo\u2018lmaydi.', 409, 'CERTIFICATE_REVOKED');
export const certificateAlreadyRevoked = (): AppError =>
  error('Sertifikat allaqachon bekor qilingan.', 409, 'CERTIFICATE_ALREADY_REVOKED');
export const certificateVersionConflict = (): AppError =>
  error(
    'Sertifikat holati o\u2018zgargan. Ma\u2018lumotni yangilang.',
    409,
    'CERTIFICATE_VERSION_CONFLICT',
  );
export const certificateRateLimited = (): AppError =>
  error(
    'Juda ko\u2018p so\u2018rov yuborildi. Birozdan so\u2018ng qayta urinib ko\u2018ring.',
    429,
    'RATE_LIMIT_EXCEEDED',
  );

export class CertificateIssuanceRepositoryConflictError extends Error {
  constructor(
    readonly kind: 'already-issued' | 'idempotency' | 'numbering' | 'serialization',
    readonly attempt = 1,
  ) {
    super(`Certificate issuance repository conflict: ${kind}`);
    this.name = 'CertificateIssuanceRepositoryConflictError';
  }
}

export class CertificateRateLimitRepositoryError extends Error {
  constructor() {
    super('Certificate operation rate limit exceeded.');
    this.name = 'CertificateRateLimitRepositoryError';
  }
}
