import { AppError } from '../../utils/app-error.js';

export function accessDenied(): AppError {
  return new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

export function courseScopeDenied(): AppError {
  return new AppError('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
}

export function courseNotFound(): AppError {
  return new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
}

export function enrollmentNotFound(): AppError {
  return new AppError('Ro\u2018yxatdan o\u2018tish topilmadi.', 404, 'ENROLLMENT_NOT_FOUND');
}

export function completionEvidenceConflict(): AppError {
  return new AppError(
    'Kursni yakunlash dalillari o\u2018zaro mos emas.',
    409,
    'COMPLETION_EVIDENCE_CONFLICT',
  );
}
