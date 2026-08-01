import { SessionClientType } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  createRejectUntrustedOrigin,
  createRequireTrustedBrowserOrigin,
} from '../../src/middlewares/trusted-origin.middleware.js';
import { AuthController } from '../../src/modules/auth/auth.controller.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import {
  isBrowserCookieRequest,
  type BrowserSessionConfiguration,
} from '../../src/modules/auth/browser-session-transport.js';
import {
  FakeAccessTokenService,
  FakeAuthRepository,
  FakePasswordService,
  FakeRefreshTokenService,
  FakeUserRepository,
} from '../helpers/auth-fakes.js';

const frontendOrigin = 'http://localhost:5173';
const trustedOrigins = new Set([frontendOrigin]);
const browserHeaders = {
  Origin: frontendOrigin,
  'X-Auth-Transport': 'cookie',
};
const loginBody = {
  email: 'admin@example.com',
  password: 'ValidPassword1!',
  clientType: SessionClientType.WEB,
};

function cookieValues(response: request.Response): string[] {
  const header = response.headers['set-cookie'];
  if (Array.isArray(header)) return header;
  return typeof header === 'string' ? [header] : [];
}

function setup(configurationOverrides: Partial<BrowserSessionConfiguration> = {}) {
  const users = new FakeUserRepository();
  const repository = new FakeAuthRepository(users);
  const refreshTokens = new FakeRefreshTokenService();
  const service = new AuthService(
    users,
    repository,
    new FakePasswordService(),
    new FakeAccessTokenService(),
    refreshTokens,
    {
      refreshTokenExpiresInMs: 30 * 86_400_000,
      maximumFailedAttempts: 3,
      lockoutDurationMs: 15 * 60_000,
    },
  );
  const configuration: BrowserSessionConfiguration = {
    cookieName: 'test_refresh',
    cookiePath: '/api/v1/auth',
    cookieSameSite: 'lax',
    cookieSecure: false,
    ...configurationOverrides,
  };
  const app = express();
  app.use(createRejectUntrustedOrigin(trustedOrigins));
  app.use(express.json());
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      controller: new AuthController(service, configuration),
      authenticationMiddleware: (req, _res, next) => {
        (req as typeof req & { auth: unknown }).auth = {
          userId: users.user!.id,
          sessionId: [...repository.sessions.values()].at(-1)?.id,
          clientType: SessionClientType.WEB,
          roles: users.user!.roles,
          permissions: users.user!.permissions,
        };
        next();
      },
      browserCsrfProtection: createRequireTrustedBrowserOrigin(
        trustedOrigins,
        isBrowserCookieRequest,
      ),
    }),
  );
  app.use(errorHandler);

  return { app, repository };
}

describe('secure browser session HTTP transport', () => {
  it('sets a scoped HttpOnly SameSite refresh cookie and omits it from browser JSON', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set(browserHeaders)
      .send(loginBody);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(response.body.data).not.toHaveProperty('refreshTokenExpiresAt');
    expect(cookieValues(response)[0]).toMatch(
      /^test_refresh=[^;]+; Max-Age=\d+; Path=\/api\/v1\/auth; Expires=.+; HttpOnly; SameSite=Lax$/u,
    );
  });

  it('marks the browser refresh cookie Secure in production configuration', async () => {
    const { app } = setup({ cookieSecure: true });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set(browserHeaders)
      .send(loginBody);

    expect(cookieValues(response)[0]).toContain('; Secure;');
  });

  it('refreshes from the cookie, rotates it once and rejects reuse of the old cookie', async () => {
    const { app, repository } = setup();
    const login = await request(app).post('/api/v1/auth/login').set(browserHeaders).send(loginBody);
    const originalCookie = cookieValues(login)[0]!.split(';')[0]!;
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set(browserHeaders)
      .set('Cookie', originalCookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data).not.toHaveProperty('refreshToken');
    expect(cookieValues(refreshed)[0]!.split(';')[0]).not.toBe(originalCookie);
    expect(
      [...repository.sessions.values()].filter((item) => item.revokedAt === null),
    ).toHaveLength(1);

    const reused = await request(app)
      .post('/api/v1/auth/refresh')
      .set(browserHeaders)
      .set('Cookie', originalCookie);
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('INVALID_REFRESH_TOKEN');
    expect(cookieValues(reused)[0]).toContain('test_refresh=;');
    expect([...repository.sessions.values()].every((item) => item.revokedAt !== null)).toBe(true);
  });

  it('clears invalid cookies and never returns their raw value in errors', async () => {
    const invalidToken = 'invalid-refresh-token-with-sufficient-length';
    const { app } = setup();
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set(browserHeaders)
      .set('Cookie', `test_refresh=${invalidToken}`);

    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain(invalidToken);
    expect(cookieValues(response)[0]).toContain('test_refresh=;');
  });

  it('clears malformed and duplicate refresh cookies instead of selecting a value', async () => {
    const { app } = setup();
    const malformed = await request(app)
      .post('/api/v1/auth/refresh')
      .set(browserHeaders)
      .set('Cookie', 'test_refresh=%E0%A4%A');
    const duplicate = await request(app)
      .post('/api/v1/auth/refresh')
      .set(browserHeaders)
      .set(
        'Cookie',
        'test_refresh=first-valid-length-token; test_refresh=second-valid-length-token',
      );

    for (const response of [malformed, duplicate]) {
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
      expect(cookieValues(response)[0]).toContain('test_refresh=;');
    }
  });

  it('revokes the cookie session, clears the cookie and keeps repeated logout idempotent', async () => {
    const { app, repository } = setup();
    const login = await request(app).post('/api/v1/auth/login').set(browserHeaders).send(loginBody);
    const cookie = cookieValues(login)[0]!.split(';')[0]!;
    const first = await request(app)
      .post('/api/v1/auth/logout')
      .set(browserHeaders)
      .set('Cookie', cookie);
    const second = await request(app).post('/api/v1/auth/logout').set(browserHeaders);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(cookieValues(first)[0]).toContain('test_refresh=;');
    expect(cookieValues(second)[0]).toContain('test_refresh=;');
    expect([...repository.sessions.values()].every((item) => item.revokedAt !== null)).toBe(true);
  });

  it('revokes every session and clears the browser cookie on logout-all', async () => {
    const { app, repository } = setup();
    const login = await request(app).post('/api/v1/auth/login').set(browserHeaders).send(loginBody);
    const cookie = cookieValues(login)[0]!.split(';')[0]!;
    const response = await request(app)
      .post('/api/v1/auth/logout-all')
      .set(browserHeaders)
      .set('Authorization', 'Bearer valid-access-token')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(cookieValues(response)[0]).toContain('test_refresh=;');
    expect([...repository.sessions.values()].every((item) => item.revokedAt !== null)).toBe(true);
  });

  it('rejects cookie/body ambiguity without rotating either credential', async () => {
    const { app, repository } = setup();
    const login = await request(app).post('/api/v1/auth/login').set(browserHeaders).send(loginBody);
    const cookie = cookieValues(login)[0]!.split(';')[0]!;
    const activeBefore = [...repository.sessions.values()].filter(
      (item) => item.revokedAt === null,
    ).length;
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set(browserHeaders)
      .set('Cookie', cookie)
      .send({ refreshToken: 'body-refresh-token-with-sufficient-length' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('AMBIGUOUS_REFRESH_TRANSPORT');
    expect(
      [...repository.sessions.values()].filter((item) => item.revokedAt === null),
    ).toHaveLength(activeBefore);
  });

  it('rejects cookie/body ambiguity during logout without revoking either credential', async () => {
    const { app, repository } = setup();
    const login = await request(app).post('/api/v1/auth/login').set(browserHeaders).send(loginBody);
    const cookie = cookieValues(login)[0]!.split(';')[0]!;
    const activeBefore = [...repository.sessions.values()].filter(
      (item) => item.revokedAt === null,
    ).length;
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set(browserHeaders)
      .set('Cookie', cookie)
      .send({ refreshToken: 'body-refresh-token-with-sufficient-length' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('AMBIGUOUS_REFRESH_TRANSPORT');
    expect(cookieValues(response)[0]).toContain('test_refresh=;');
    expect(
      [...repository.sessions.values()].filter((item) => item.revokedAt === null),
    ).toHaveLength(activeBefore);
  });

  it('requires a trusted Origin or Referer for cookie-authenticated requests', async () => {
    const { app } = setup();
    const missing = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Auth-Transport', 'cookie')
      .send(loginBody);
    const untrusted = await request(app)
      .post('/api/v1/auth/login')
      .set({ Origin: 'https://attacker.example', 'X-Auth-Transport': 'cookie' })
      .send(loginBody);
    const referer = await request(app)
      .post('/api/v1/auth/login')
      .set({
        Referer: `${frontendOrigin}/login`,
        'X-Auth-Transport': 'cookie',
      })
      .send(loginBody);

    expect(missing.status).toBe(403);
    expect(missing.body.code).toBe('UNTRUSTED_ORIGIN');
    expect(untrusted.status).toBe(403);
    expect(untrusted.body.code).toBe('UNTRUSTED_ORIGIN');
    expect(referer.status).toBe(200);
  });

  it('preserves the legacy body refresh-token contract without ambient cookies', async () => {
    const { app } = setup();
    const login = await request(app).post('/api/v1/auth/login').send(loginBody);
    const refreshToken = login.body.data.refreshToken as string;
    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(login.status).toBe(200);
    expect(refreshToken).toMatch(/^refresh-token-/u);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).toMatch(/^refresh-token-/u);
    expect(cookieValues(refreshed)).toHaveLength(0);
  });

  it('prevents browser-origin requests from downgrading to legacy token responses', async () => {
    const { app, repository } = setup();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', frontendOrigin)
      .send(loginBody);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_AUTH_TRANSPORT');
    expect(response.body).not.toHaveProperty('data.refreshToken');
    expect(repository.sessions.size).toBe(0);
  });
});
