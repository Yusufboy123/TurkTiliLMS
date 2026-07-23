import type { RoleCode } from '@prisma/client';
import type { RequestHandler } from 'express';
import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { accessTokenService } from '../auth/auth.container.js';
import type { AccessTokenService } from '../auth/auth.types.js';
import {
  type AuthorizationRepository,
  PrismaAuthorizationRepository,
} from './authorization.repository.js';
import type { AuthenticatedPrincipal } from './authorization.types.js';

export function createRequireAuthentication(
  tokenService: AccessTokenService,
  repository: AuthorizationRepository,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const authorizationHeader = request.header('authorization');
    const [scheme, token, extra] = authorizationHeader?.trim().split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
      throw new AppError(
        'Davom etish uchun tizimga kirish talab qilinadi.',
        401,
        'AUTHENTICATION_REQUIRED',
      );
    }

    const claims = tokenService.verify(token);
    const now = new Date();
    const principal = await repository.findActivePrincipal(claims.sub, claims.sessionId, now);

    if (!principal) {
      throw new AppError(
        'Kirish sessiyasi yaroqsiz yoki muddati tugagan.',
        401,
        'INVALID_ACCESS_TOKEN',
      );
    }

    (request as typeof request & { auth?: typeof principal }).auth = principal;
    await repository.touchSession(principal.sessionId, now);
    next();
  });
}

export function requireRole(...allowedRoles: RoleCode[]): RequestHandler {
  return (request, _response, next) => {
    const principal = (request as typeof request & { auth?: AuthenticatedPrincipal }).auth;

    if (!principal) {
      next(
        new AppError(
          'Davom etish uchun tizimga kirish talab qilinadi.',
          401,
          'AUTHENTICATION_REQUIRED',
        ),
      );
      return;
    }

    if (!allowedRoles.some((role) => principal.roles.includes(role))) {
      next(new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED'));
      return;
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: string[]): RequestHandler {
  return (request, _response, next) => {
    const principal = (request as typeof request & { auth?: AuthenticatedPrincipal }).auth;

    if (!principal) {
      next(
        new AppError(
          'Davom etish uchun tizimga kirish talab qilinadi.',
          401,
          'AUTHENTICATION_REQUIRED',
        ),
      );
      return;
    }

    if (!requiredPermissions.every((permission) => principal.permissions.includes(permission))) {
      next(new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED'));
      return;
    }

    next();
  };
}

const authorizationRepository = new PrismaAuthorizationRepository();

export const requireAuthentication = createRequireAuthentication(
  accessTokenService,
  authorizationRepository,
);
