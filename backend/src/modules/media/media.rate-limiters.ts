import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request } from 'express';

const response = {
  success: false,
  code: 'MEDIA_UPLOAD_RATE_LIMITED',
  message: "Media yuklash urinishlari vaqtincha cheklangan. Birozdan keyin qayta urinib ko'ring.",
};

function userKey(request: Request): string {
  const principal = (request as Request & { auth?: { userId?: string } }).auth;
  return principal?.userId ? `user:${principal.userId}` : `ip:${ipKeyGenerator(request.ip ?? 'unknown')}`;
}

export const mediaUploadRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: userKey,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: response,
});
