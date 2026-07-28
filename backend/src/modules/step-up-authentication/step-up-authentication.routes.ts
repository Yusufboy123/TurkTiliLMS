import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication } from '../authorization/authorization.middleware.js';
import { stepUpAuthenticationController } from './step-up-authentication.container.js';
import type { StepUpAuthenticationController } from './step-up-authentication.controller.js';
import {
  requireStepUpChallengeAuthorization,
  requireStepUpVerificationAuthorization,
} from './step-up-authentication.authorization.js';
import {
  stepUpChallengeRateLimiter,
  stepUpVerificationRateLimiter,
} from './step-up-authentication.rate-limiters.js';

interface StepUpAuthenticationRouterDependencies {
  controller: StepUpAuthenticationController;
  authentication: RequestHandler;
  challengeAuthorization: RequestHandler;
  verificationAuthorization: RequestHandler;
  challengeRateLimiter: RequestHandler;
  verificationRateLimiter: RequestHandler;
}

export function createStepUpAuthenticationRouter(
  dependencies: StepUpAuthenticationRouterDependencies,
): Router {
  const router = Router();

  router.post(
    '/challenges',
    dependencies.authentication,
    dependencies.challengeAuthorization,
    dependencies.challengeRateLimiter,
    asyncHandler(dependencies.controller.createChallenge),
  );
  router.post(
    '/challenges/:challengeId/verify',
    dependencies.authentication,
    dependencies.verificationAuthorization,
    dependencies.verificationRateLimiter,
    asyncHandler(dependencies.controller.verifyChallenge),
  );

  return router;
}

export const stepUpAuthenticationRouter = createStepUpAuthenticationRouter({
  controller: stepUpAuthenticationController,
  authentication: requireAuthentication,
  challengeAuthorization: requireStepUpChallengeAuthorization,
  verificationAuthorization: requireStepUpVerificationAuthorization,
  challengeRateLimiter: stepUpChallengeRateLimiter,
  verificationRateLimiter: stepUpVerificationRateLimiter,
});
