import { randomUUID } from 'node:crypto';
import { PrismaClient, SessionClientType } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaAuthRepository } from '../../src/modules/auth/auth.repository.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { BcryptPasswordService } from '../../src/modules/auth/password.service.js';
import { CryptoRefreshTokenService } from '../../src/modules/auth/refresh-token.service.js';
import { PrismaUserRepository } from '../../src/modules/users/user.repository.js';
import { AppError } from '../../src/utils/app-error.js';
import { FakeAccessTokenService } from '../helpers/auth-fakes.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const password = 'BrowserSessionPassword1!';
const metadata = {
  clientType: SessionClientType.WEB,
  ipAddress: '127.0.0.1',
  userAgent: 'browser-session-integration-test',
};

describeDatabase('secure browser session persistence on PostgreSQL', () => {
  const client = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const passwordService = new BcryptPasswordService(10);
  const refreshTokens = new CryptoRefreshTokenService();
  const service = new AuthService(
    new PrismaUserRepository(client),
    new PrismaAuthRepository(client),
    passwordService,
    new FakeAccessTokenService(),
    refreshTokens,
    {
      refreshTokenExpiresInMs: 30 * 86_400_000,
      maximumFailedAttempts: 3,
      lockoutDurationMs: 15 * 60_000,
    },
  );
  let userId = '';
  let email = '';

  beforeEach(async () => {
    email = `browser-session-${randomUUID()}@example.com`;
    const user = await client.user.create({
      data: {
        email,
        credential: {
          create: { passwordHash: await passwordService.hash(password) },
        },
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await client.auditLog.deleteMany({ where: { actorUserId: userId } });
    await client.user.deleteMany({ where: { id: userId } });
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it('stores only a hash, rotates atomically and rejects reuse of the replaced token', async () => {
    const login = await service.login(
      { email, password, clientType: SessionClientType.WEB },
      metadata,
    );
    const firstSession = await client.userSession.findUniqueOrThrow({
      where: { refreshTokenHash: refreshTokens.hash(login.refreshToken) },
    });

    expect(JSON.stringify(firstSession)).not.toContain(login.refreshToken);
    expect(firstSession.revokedAt).toBeNull();

    const refreshed = await service.refresh({ refreshToken: login.refreshToken }, metadata);
    const [replaced, replacement] = await Promise.all([
      client.userSession.findUniqueOrThrow({ where: { id: firstSession.id } }),
      client.userSession.findUniqueOrThrow({
        where: { refreshTokenHash: refreshTokens.hash(refreshed.refreshToken) },
      }),
    ]);

    expect(replaced.revokedAt).not.toBeNull();
    expect(replaced.replacedBySessionId).toBe(replacement.id);
    expect(replacement.revokedAt).toBeNull();
    const audits = await client.auditLog.findMany({ where: { actorUserId: userId } });
    expect(JSON.stringify(audits)).not.toContain(login.refreshToken);
    expect(JSON.stringify(audits)).not.toContain(refreshed.refreshToken);

    await expect(
      service.refresh({ refreshToken: login.refreshToken }, metadata),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN', statusCode: 401 });
    await expect(client.userSession.count({ where: { userId, revokedAt: null } })).resolves.toBe(0);
  });

  it('revokes the exact session selected by a browser refresh credential', async () => {
    const login = await service.login(
      { email, password, clientType: SessionClientType.WEB },
      metadata,
    );

    await service.logoutByRefreshToken(login.refreshToken, metadata);

    await expect(
      client.userSession.findUniqueOrThrow({
        where: { refreshTokenHash: refreshTokens.hash(login.refreshToken) },
      }),
    ).resolves.toEqual(expect.objectContaining({ revokedAt: expect.any(Date) }));
    await service.logoutByRefreshToken(login.refreshToken, metadata);
  });

  it('allows only one concurrent rotation and revokes the family after replay detection', async () => {
    const login = await service.login(
      { email, password, clientType: SessionClientType.WEB },
      metadata,
    );
    const results = await Promise.allSettled([
      service.refresh({ refreshToken: login.refreshToken }, metadata),
      service.refresh({ refreshToken: login.refreshToken }, metadata),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(AppError);
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    await expect(client.userSession.count({ where: { userId, revokedAt: null } })).resolves.toBe(0);
  });

  it('does not leave a rotated descendant active when refresh races browser logout', async () => {
    const login = await service.login(
      { email, password, clientType: SessionClientType.WEB },
      metadata,
    );
    const results = await Promise.allSettled([
      service.refresh({ refreshToken: login.refreshToken }, metadata),
      service.logoutByRefreshToken(login.refreshToken, metadata),
    ]);

    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    await expect(client.userSession.count({ where: { userId, revokedAt: null } })).resolves.toBe(0);
  });
});
