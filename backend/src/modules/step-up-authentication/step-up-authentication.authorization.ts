import { RoleCode, StepUpAction } from '@prisma/client';
import type { RequestHandler } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';

function deny(next: Parameters<RequestHandler>[2]): void {
  next(new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED'));
}

function principalFrom(request: Parameters<RequestHandler>[0]): AuthenticatedPrincipal | undefined {
  return (request as typeof request & { auth?: AuthenticatedPrincipal }).auth;
}

export const requireStepUpChallengeAuthorization: RequestHandler = (request, _response, next) => {
  const principal = principalFrom(request);
  if (!principal?.roles.includes(RoleCode.ADMIN)) {
    deny(next);
    return;
  }
  const action = (request.body as { action?: unknown } | undefined)?.action;
  const permission =
    action === StepUpAction.CERTIFICATE_ISSUE
      ? 'certificates.issue'
      : action === StepUpAction.CERTIFICATE_REVOKE
        ? 'certificates.revoke'
        : null;
  if (permission && !principal.permissions.includes(permission)) {
    deny(next);
    return;
  }
  next();
};

export const requireStepUpVerificationAuthorization: RequestHandler = (
  request,
  _response,
  next,
) => {
  const principal = principalFrom(request);
  if (
    !principal?.roles.includes(RoleCode.ADMIN) ||
    !principal.permissions.some((permission) =>
      ['certificates.issue', 'certificates.revoke'].includes(permission),
    )
  ) {
    deny(next);
    return;
  }
  next();
};
