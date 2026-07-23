import { rateLimit } from 'express-rate-limit';

const rateLimitResponse = {
  success: false,
  code: 'AUTH_RATE_LIMITED',
  message: 'Juda ko‘p urinish yuborildi. Birozdan keyin qayta urinib ko‘ring.',
};

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse,
});

export const credentialRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: rateLimitResponse,
});
