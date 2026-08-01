import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  adminDashboardActor,
  adminDashboardAuditContext,
  adminDashboardPrincipal,
} from './admin-dashboard.request-context.js';
import type { AdminDashboardUseCases } from './admin-dashboard.service.js';

function rateLimitHeaders(
  limit: number,
  remaining: number,
  reset: number,
  key: string,
): { rateLimit: string; policy: string } {
  const name = `${limit}-in-1min`;
  const partitionKey = createHash('sha256').update(key).digest('hex').slice(0, 12);
  return {
    rateLimit: `"${name}"; r=${remaining}; t=${reset}`,
    policy: `"${name}"; q=${limit}; w=60; pk=:${partitionKey}:`,
  };
}

export function createAdminDashboardRateLimitMiddleware(
  service: AdminDashboardUseCases,
): RequestHandler {
  return asyncHandler(async (request, response, next) => {
    const principal = adminDashboardPrincipal(request);
    const actor = adminDashboardActor(principal);
    const context = adminDashboardAuditContext(request, principal);
    const decision = await service.consumeRateLimit(actor, context);
    const headers = rateLimitHeaders(
      decision.limit,
      decision.remaining,
      decision.resetAfterSeconds,
      `${actor.userId}:${context.ipHash}`,
    );
    response.setHeader('RateLimit', headers.rateLimit);
    response.setHeader('RateLimit-Policy', headers.policy);

    if (!decision.allowed) {
      response.setHeader('Retry-After', String(decision.resetAfterSeconds));
      throw new AppError(
        'Juda ko‘p so‘rov yuborildi. Birozdan so‘ng qayta urinib ko‘ring.',
        429,
        'RATE_LIMIT_EXCEEDED',
      );
    }
    next();
  });
}

export const adminDashboardNoStore: RequestHandler = (_request, response, next) => {
  response.setHeader('Cache-Control', 'private, no-store');
  next();
};
