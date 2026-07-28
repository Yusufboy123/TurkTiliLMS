import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';

const response = {
  success: false,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Juda ko\u2018p urinish yuborildi. Birozdan so\u2018ng qayta urinib ko\u2018ring.',
};

function principalFrom(request: Request): AuthenticatedPrincipal | undefined {
  return (request as Request & { auth?: AuthenticatedPrincipal }).auth;
}

export const stepUpChallengeRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const principal = principalFrom(request);
    return principal ? `${principal.userId}:${principal.sessionId}` : 'unauthenticated';
  },
  message: response,
});

export const stepUpVerificationRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const principal = principalFrom(request);
    const ipKey = ipKeyGenerator(request.ip ?? 'unknown');
    const ipHash = createHash('sha256').update(ipKey).digest('hex');
    return principal ? `${principal.userId}:${ipHash}` : `unauthenticated:${ipHash}`;
  },
  message: response,
});
