import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  createStepUpChallengeSchema,
  stepUpChallengeParamsSchema,
  verifyStepUpChallengeSchema,
} from './step-up-authentication.schemas.js';
import type { StepUpAuthenticationUseCases } from './step-up-authentication.service.js';
import type { StepUpActor, StepUpAuditContext } from './step-up-authentication.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function principalFrom(request: Request): AuthenticatedPrincipal {
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

function actorFrom(principal: AuthenticatedPrincipal): StepUpActor {
  return {
    userId: principal.userId,
    sessionId: principal.sessionId,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function auditContext(request: Request, principal: AuthenticatedPrincipal): StepUpAuditContext {
  const requestId = request.header('x-request-id');
  const userAgent = request.header('user-agent')?.slice(0, 512);
  const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined;
  return {
    actorUserId: principal.userId,
    ...(requestId && uuidPattern.test(requestId) ? { requestCorrelationId: requestId } : {}),
    ...(ipHash ? { ipHash } : {}),
    ...(userAgent ? { userAgentSummary: userAgent } : {}),
  };
}

export class StepUpAuthenticationController {
  constructor(private readonly service: StepUpAuthenticationUseCases) {}

  createChallenge = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const input = createStepUpChallengeSchema.parse(request.body);
    const data = await this.service.createChallenge(
      input,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(201).json({
      success: true,
      message: 'Qo\u2018shimcha tasdiqlash so\u2018rovi yaratildi.',
      data,
    });
  };

  verifyChallenge = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { challengeId } = stepUpChallengeParamsSchema.parse(request.params);
    const input = verifyStepUpChallengeSchema.parse(request.body);
    const data = await this.service.verifyChallenge(
      challengeId,
      input,
      actorFrom(principal),
      auditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Shaxs muvaffaqiyatli qayta tasdiqlandi.',
      data,
    });
  };
}
