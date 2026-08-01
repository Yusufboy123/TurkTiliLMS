import { Router, type RequestHandler } from 'express';
import { environment } from '../../config/environment.js';
import { createRequireTrustedBrowserOrigin } from '../../middlewares/trusted-origin.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication } from '../authorization/authorization.middleware.js';
import { authenticationService, browserSessionConfiguration } from './auth.container.js';
import { AuthController } from './auth.controller.js';
import { authRateLimiter, credentialRateLimiter } from './auth.rate-limiters.js';
import { isBrowserCookieRequest } from './browser-session-transport.js';

interface AuthRouterDependencies {
  controller: AuthController;
  authenticationMiddleware: RequestHandler;
  generalRateLimiter?: RequestHandler;
  credentialRateLimiter?: RequestHandler;
  browserCsrfProtection?: RequestHandler;
}

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    next();
  });

  if (dependencies.generalRateLimiter) {
    router.use(dependencies.generalRateLimiter);
  }

  router.post(
    '/login',
    ...(dependencies.credentialRateLimiter ? [dependencies.credentialRateLimiter] : []),
    ...(dependencies.browserCsrfProtection ? [dependencies.browserCsrfProtection] : []),
    asyncHandler(dependencies.controller.login),
  );
  router.post(
    '/refresh',
    ...(dependencies.credentialRateLimiter ? [dependencies.credentialRateLimiter] : []),
    ...(dependencies.browserCsrfProtection ? [dependencies.browserCsrfProtection] : []),
    asyncHandler(dependencies.controller.refresh),
  );
  router.post(
    '/logout',
    ...(dependencies.browserCsrfProtection ? [dependencies.browserCsrfProtection] : []),
    ((request, response, next) => {
      if (isBrowserCookieRequest(request)) {
        next();
        return;
      }
      dependencies.authenticationMiddleware(request, response, next);
    }) satisfies RequestHandler,
    asyncHandler(dependencies.controller.logout),
  );
  router.post(
    '/logout-all',
    ...(dependencies.browserCsrfProtection ? [dependencies.browserCsrfProtection] : []),
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
  controller: new AuthController(authenticationService, browserSessionConfiguration),
  authenticationMiddleware: requireAuthentication,
  generalRateLimiter: authRateLimiter,
  credentialRateLimiter,
  browserCsrfProtection: createRequireTrustedBrowserOrigin(
    new Set([environment.FRONTEND_URL]),
    isBrowserCookieRequest,
  ),
});
