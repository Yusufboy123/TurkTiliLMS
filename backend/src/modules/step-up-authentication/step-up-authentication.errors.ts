import { AppError } from '../../utils/app-error.js';

export function stepUpAccessDenied(): AppError {
  return new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

export function stepUpVerificationFailed(): AppError {
  return new AppError(
    'Shaxsni qo\u2018shimcha tasdiqlash muvaffaqiyatsiz tugadi.',
    403,
    'STEP_UP_VERIFICATION_FAILED',
  );
}

export function stepUpRequired(): AppError {
  return new AppError(
    'Davom etish uchun parolni qayta tasdiqlash talab qilinadi.',
    428,
    'STEP_UP_REQUIRED',
  );
}

export function stepUpProofExpired(): AppError {
  return new AppError('Qo\u2018shimcha tasdiqlash muddati tugagan.', 428, 'STEP_UP_PROOF_EXPIRED');
}

export function stepUpProofInvalid(): AppError {
  return new AppError(
    'Qo\u2018shimcha tasdiqlash ma\u2018lumoti yaroqsiz.',
    428,
    'STEP_UP_PROOF_INVALID',
  );
}

export function stepUpRateLimited(): AppError {
  return new AppError(
    'Juda ko\u2018p urinish yuborildi. Birozdan so\u2018ng qayta urinib ko\u2018ring.',
    429,
    'RATE_LIMIT_EXCEEDED',
  );
}

export class StepUpTransactionConflictError extends Error {
  constructor() {
    super('Step-up transaction retry limit exceeded.');
    this.name = 'StepUpTransactionConflictError';
  }
}
