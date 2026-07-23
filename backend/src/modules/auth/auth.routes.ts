import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication } from '../authorization/authorization.middleware.js';
import { authenticationService } from './auth.container.js';
import { AuthController } from './auth.controller.js';
import { authRateLimiter, credentialRateLimiter } from './auth.rate-limiters.js';

interface AuthRouterDependencies {
  controller: AuthController;
  authenticationMiddleware: RequestHandler;
  generalRateLimiter?: RequestHandler;
  credentialRateLimiter?: RequestHandler;
}

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const router = Router();

  if (dependencies.generalRateLimiter) {
    router.use(dependencies.generalRateLimiter);
  }

  router.post(
    '/login',
    ...(dependencies.credentialRateLimiter ? [dependencies.credentialRateLimiter] : []),
    asyncHandler(dependencies.controller.login),
  );
  router.post(
    '/refresh',
    ...(dependencies.credentialRateLimiter ? [dependencies.credentialRateLimiter] : []),
    asyncHandler(dependencies.controller.refresh),
  );
  router.post(
    '/logout',
    dependencies.authenticationMiddleware,
    asyncHandler(dependencies.controller.logout),
  );
  router.post(
    '/logout-all',
    dependencies.authenticationMiddleware,
    asyncHandler(dependencies.controller.logoutAll),
  );
  router.get(
    '/me',
    dependencies.authenticationMiddleware,
    asyncHandler(dependencies.controller.me),
  );
  router.post(
    '/change-password',
    dependencies.authenticationMiddleware,
    asyncHandler(dependencies.controller.changePassword),
  );

  return router;
}

export const authRouter = createAuthRouter({
  controller: new AuthController(authenticationService),
  authenticationMiddleware: requireAuthentication,
  generalRateLimiter: authRateLimiter,
  credentialRateLimiter,
});
