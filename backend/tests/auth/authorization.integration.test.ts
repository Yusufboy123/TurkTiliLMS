import { RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import { AuthController } from '../../src/modules/auth/auth.controller.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import {
  createRequireAuthentication,
  requirePermission,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthorizationRepository } from '../../src/modules/authorization/authorization.repository.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import {
  FakeAccessTokenService,
  FakeAuthRepository,
  FakePasswordService,
  FakeRefreshTokenService,
  FakeUserRepository,
  TEST_SESSION_ID,
  TEST_USER_ID,
} from '../helpers/auth-fakes.js';

const browserSessionConfiguration = {
  cookieName: 'test_refresh',
  cookiePath: '/api/v1/auth',
  cookieSameSite: 'lax' as const,
  cookieSecure: false,
};

class FakeAuthorizationRepository implements AuthorizationRepository {
  principal: AuthenticatedPrincipal | null = {
    userId: TEST_USER_ID,
    sessionId: TEST_SESSION_ID,
    clientType: SessionClientType.WEB,
    roles: [RoleCode.ADMIN],
    permissions: ['users.read'],
  };

  findActivePrincipal(): Promise<AuthenticatedPrincipal | null> {
    return Promise.resolve(this.principal);
  }

  touchSession(): Promise<void> {
    return Promise.resolve();
  }
}

function createTestApp(
  tokenService = new FakeAccessTokenService(),
  authorizationRepository = new FakeAuthorizationRepository(),
) {
  const users = new FakeUserRepository();
  const service = new AuthService(
    users,
    new FakeAuthRepository(users),
    new FakePasswordService(),
    tokenService,
    new FakeRefreshTokenService(),
    {
      refreshTokenExpiresInMs: 30 * 86_400_000,
      maximumFailedAttempts: 3,
      lockoutDurationMs: 15 * 60_000,
    },
  );
  const authenticationMiddleware = createRequireAuthentication(
    tokenService,
    authorizationRepository,
  );
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      controller: new AuthController(service, browserSessionConfiguration),
      authenticationMiddleware,
    }),
  );
  app.get('/api/v1/protected', authenticationMiddleware, requirePermission('users.delete'), ((
    _request,
    response,
  ) => {
    response.status(200).json({ success: true });
  }) as RequestHandler);
  app.use(errorHandler);
  return app;
}

describe('authentication and authorization HTTP behavior', () => {
  let authorizationRepository: FakeAuthorizationRepository;

  beforeEach(() => {
    authorizationRepository = new FakeAuthorizationRepository();
  });

  it('serves an authenticated /me request without sensitive fields', async () => {
    const response = await request(
      createTestApp(new FakeAccessTokenService(), authorizationRepository),
    )
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-access-token');

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('admin@example.com');
    expect(response.body.data.user).not.toHaveProperty('credential');
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects an expired or invalid access token', async () => {
    const response = await request(
      createTestApp(new FakeAccessTokenService(), authorizationRepository),
    )
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer expired-token');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('does not allow a refresh cookie to authenticate /me or logout-all', async () => {
    const app = createTestApp(new FakeAccessTokenService(), authorizationRepository);
    const cookieOnlyMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'test_refresh=cookie-only-credential');
    const cookieOnlyLogoutAll = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('X-Auth-Transport', 'cookie')
      .set('Cookie', 'test_refresh=cookie-only-credential');

    expect(cookieOnlyMe.status).toBe(401);
    expect(cookieOnlyMe.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(cookieOnlyLogoutAll.status).toBe(401);
    expect(cookieOnlyLogoutAll.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rejects an authenticated principal without the required permission', async () => {
    const response = await request(
      createTestApp(new FakeAccessTokenService(), authorizationRepository),
    )
      .get('/api/v1/protected')
      .set('Authorization', 'Bearer valid-access-token');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ACCESS_DENIED');
  });
});
