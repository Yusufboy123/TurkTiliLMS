import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import type { AdminDashboardActor, AdminDashboardAuditContext } from './admin-dashboard.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function adminDashboardPrincipal(request: Request): AuthenticatedPrincipal {
  const principal = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!principal) {
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  }
  return principal;
}

export function adminDashboardActor(principal: AuthenticatedPrincipal): AdminDashboardActor {
  return {
    userId: principal.userId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

export function adminDashboardAuditContext(
  request: Request,
  principal: AuthenticatedPrincipal,
): AdminDashboardAuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipIdentity = ipKeyGenerator(request.ip ?? 'unknown');
  const ipHash = createHash('sha256').update(ipIdentity).digest('hex');
  return {
    actorUserId: principal.userId,
    ipHash,
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}
