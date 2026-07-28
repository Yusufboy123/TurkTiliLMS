import {
  RoleCode,
  SessionClientType,
  StepUpAction,
  StepUpContinuation,
  StepUpTargetType,
} from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import { StepUpAuthenticationController } from '../../src/modules/step-up-authentication/step-up-authentication.controller.js';
import {
  requireStepUpChallengeAuthorization,
  requireStepUpVerificationAuthorization,
} from '../../src/modules/step-up-authentication/step-up-authentication.authorization.js';
import { createStepUpAuthenticationRouter } from '../../src/modules/step-up-authentication/step-up-authentication.routes.js';
import type { StepUpAuthenticationUseCases } from '../../src/modules/step-up-authentication/step-up-authentication.service.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { AppError } from '../../src/utils/app-error.js';

const userId = '019b9e22-7f5d-7d3a-a0f1-ff64c8124a11';
const sessionId = '019b9e22-8022-796f-b12a-bb56ba452725';
const challengeId = '019b9e22-8f9c-771a-9753-67ad8f179af2';
const targetId = '019b9e22-9f9c-771a-9753-67ad8f179af3';
const continuationId = '019b9e22-af9c-771a-9753-67ad8f179af4';

function testApp(
  service: StepUpAuthenticationUseCases,
  authenticated = true,
  enforceAuthorization = false,
  principalOverrides: Partial<AuthenticatedPrincipal> = {},
) {
  const authentication: RequestHandler = (request, _response, next) => {
    if (!authenticated) {
      next(new AppError('Tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }
    const principal: AuthenticatedPrincipal = {
      userId,
      sessionId,
      clientType: SessionClientType.WEB,
      roles: [RoleCode.ADMIN],
      permissions: ['certificates.issue', 'certificates.revoke'],
      ...principalOverrides,
    };
    (request as typeof request & { auth?: AuthenticatedPrincipal }).auth = principal;
    next();
  };
  const pass: RequestHandler = (_request, _response, next) => next();
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/auth/step-up',
    createStepUpAuthenticationRouter({
      controller: new StepUpAuthenticationController(service),
      authentication,
      challengeAuthorization: enforceAuthorization ? requireStepUpChallengeAuthorization : pass,
      verificationAuthorization: enforceAuthorization
        ? requireStepUpVerificationAuthorization
        : pass,
      challengeRateLimiter: pass,
      verificationRateLimiter: pass,
    }),
  );
  app.use(errorHandler);
  return app;
}

function fakeService(): StepUpAuthenticationUseCases {
  return {
    createChallenge: vi.fn().mockResolvedValue({
      id: challengeId,
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
      verificationRequired: true,
      expiresAt: '2026-07-28T12:05:00.000Z',
      continuationId,
    }),
    verifyChallenge: vi.fn().mockResolvedValue({
      proof: 'A'.repeat(43),
      expiresAt: '2026-07-28T12:02:00.000Z',
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
      continuationId,
    }),
    consumeProof: vi.fn(),
  };
}

describe('step-up authentication routes', () => {
  it('requires authentication before challenge creation', async () => {
    const response = await request(testApp(fakeService(), false))
      .post('/api/v1/auth/step-up/challenges')
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('creates the documented challenge DTO and derives identity from the principal', async () => {
    const service = fakeService();
    const response = await request(testApp(service)).post('/api/v1/auth/step-up/challenges').send({
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
      continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: { id: challengeId, targetId, verificationRequired: true },
    });
    expect(service.createChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ targetId }),
      expect.objectContaining({ userId, sessionId }),
      expect.objectContaining({ actorUserId: userId }),
    );
  });

  it('enforces ADMIN and the action-specific permission before the controller', async () => {
    const service = fakeService();
    const response = await request(
      testApp(service, true, true, {
        roles: [RoleCode.TEACHER],
        permissions: ['certificates.issue'],
      }),
    )
      .post('/api/v1/auth/step-up/challenges')
      .send({
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ACCESS_DENIED');
    expect(service.createChallenge).not.toHaveBeenCalled();
  });

  it('rejects mismatched action, target and continuation bindings', async () => {
    const response = await request(testApp(fakeService()))
      .post('/api/v1/auth/step-up/challenges')
      .send({
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.CERTIFICATE,
        targetId,
        continuation: StepUpContinuation.CERTIFICATE_REVOKE_CONFIRMATION,
      });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('verifies a challenge with exactly one approved verification method', async () => {
    const service = fakeService();
    const response = await request(testApp(service))
      .post(`/api/v1/auth/step-up/challenges/${challengeId}/verify`)
      .send({ password: 'CurrentPassword1!' });
    expect(response.status).toBe(200);
    expect(response.body.data.proof).toHaveLength(43);

    const invalid = await request(testApp(fakeService()))
      .post(`/api/v1/auth/step-up/challenges/${challengeId}/verify`)
      .send({ password: 'CurrentPassword1!', confirmRecentAuthentication: true });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
  });

  it('does not expose a generic public proof-consumption endpoint', async () => {
    const response = await request(testApp(fakeService()))
      .post('/api/v1/auth/step-up/proofs/consume')
      .send({ proof: 'A'.repeat(43) });
    expect(response.status).toBe(404);
  });
});
