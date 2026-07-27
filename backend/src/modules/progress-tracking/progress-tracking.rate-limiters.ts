import { rateLimit } from 'express-rate-limit';

const response = {
  success: false,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Juda ko‘p so‘rov yuborildi. Birozdan so‘ng qayta urinib ko‘ring.',
};

function progressRateLimit(limit: number) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: response,
  });
}

export const blockProgressMutationRateLimiter = progressRateLimit(60);
export const lessonProgressMutationRateLimiter = progressRateLimit(30);
export const progressActivityRateLimiter = progressRateLimit(120);
