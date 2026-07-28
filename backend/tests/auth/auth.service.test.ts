import { SessionClientType, UserStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/utils/app-error.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import {
  FakeAccessTokenService,
  FakeAuthRepository,
  FakePasswordService,
  FakeRefreshTokenService,
  FakeUserRepository,
  TEST_SESSION_ID,
  TEST_USER_ID,
  createTestUser,
} from '../helpers/auth-fakes.js';

const now = new Date('2026-07-23T12:00:00.000Z');
const metadata = { clientType: SessionClientType.WEB, ipAddress: '127.0.0.1' };
const validLogin = {
  email: 'admin@example.com',
  password: 'ValidPassword1!',
  clientType: SessionClientType.WEB,
};

function setup(user = createTestUser()) {
  const users = new FakeUserRepository(user);
  const auth = new FakeAuthRepository(users);
  const passwords = new FakePasswordService();
  const accessTokens = new FakeAccessTokenService();
  const refreshTokens = new FakeRefreshTokenService();
  const service = new AuthService(
    users,
    auth,
    passwords,
    accessTokens,
    refreshTokens,
    {
      refreshTokenExpiresInMs: 30 * 86_400_000,
      maximumFailedAttempts: 3,
      lockoutDurationMs: 15 * 60_000,
    },
    () => now,
  );

  return { service, users, auth, passwords, accessTokens, refreshTokens };
}

async function expectAppError(operation: Promise<unknown>, code: string): Promise<AppError> {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }

  throw new Error(`Expected AppError with code ${code}.`);
}

describe('AuthService', () => {
  it('logs in with valid credentials and returns only a safe user profile', async () => {
    const { service } = setup();

    const result = await service.login(validLogin, metadata);

    expect(result.accessToken).toBe(`access:${TEST_SESSION_ID}`);
    expect(result.refreshToken).toContain('refresh-token-1');
    expect(result.user).toEqual({
      id: TEST_USER_ID,
      email: 'admin@example.com',
      firstName: 'Ali',
      lastName: 'Valiyev',
      status: UserStatus.ACTIVE,
      lastLoginAt: now,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns a generic error for an unknown email and performs dummy verification', async () => {
    const { service, users, passwords } = setup();
    users.user = null;

    const error = await expectAppError(service.login(validLogin, metadata), 'INVALID_CREDENTIALS');

    expect(error.message).toBe('Email yoki parol noto‘g‘ri.');
    expect(passwords.dummyVerificationCount).toBe(1);
  });

  it('rejects a suspended user with the same generic credential message', async () => {
    const { service } = setup(createTestUser({ status: UserStatus.SUSPENDED }));

    const error = await expectAppError(service.login(validLogin, metadata), 'INVALID_CREDENTIALS');

    expect(error.message).toBe('Email yoki parol noto‘g‘ri.');
  });

  it('rejects login generically when the credential changes after password verification', async () => {
    const { service, auth } = setup();
    auth.rejectLoginForCredentialConflict = true;

    const error = await expectAppError(service.login(validLogin, metadata), 'INVALID_CREDENTIALS');

    expect(error.statusCode).toBe(401);
    expect(auth.sessions.size).toBe(0);
  });

  it('locks an active account after the configured failed-attempt limit', async () => {
    const { service, users } = setup();
    const invalidLogin = { ...validLogin, password: 'WrongPassword1!' };

    await expectAppError(service.login(invalidLogin, metadata), 'INVALID_CREDENTIALS');
    await expectAppError(service.login(invalidLogin, metadata), 'INVALID_CREDENTIALS');
    await expectAppError(service.login(invalidLogin, metadata), 'INVALID_CREDENTIALS');

    expect(users.user?.credential?.failedLoginCount).toBe(3);
    expect(users.user?.credential?.lockedUntil).toEqual(new Date(now.getTime() + 15 * 60_000));
    await expectAppError(service.login(validLogin, metadata), 'INVALID_CREDENTIALS');
  });

  it('rotates a valid refresh token and revokes the previous session', async () => {
    const { service, auth, refreshTokens } = setup();
    const oldToken = 'old-refresh-token-with-sufficient-test-length';
    const oldSession = auth.addRefreshSession(oldToken, refreshTokens);

    const result = await service.refresh({ refreshToken: oldToken }, metadata);

    expect(result.refreshToken).not.toBe(oldToken);
    expect(oldSession.revokedAt).toEqual(now);
    expect(oldSession.replacedBySessionId).not.toBeNull();
  });

  it('detects reuse of a rotated refresh token and revokes the token family', async () => {
    const { service, auth, refreshTokens } = setup();
    const oldToken = 'old-refresh-token-with-sufficient-test-length';
    auth.addRefreshSession(oldToken, refreshTokens);
    await service.refresh({ refreshToken: oldToken }, metadata);

    await expectAppError(
      service.refresh({ refreshToken: oldToken }, metadata),
      'INVALID_REFRESH_TOKEN',
    );

    expect(auth.reuseDetections).toBe(1);
    expect([...auth.sessions.values()].every((session) => session.revokedAt !== null)).toBe(true);
  });

  it('revokes the current session on logout', async () => {
    const { service, auth } = setup();

    await service.logout(TEST_USER_ID, TEST_SESSION_ID, metadata);

    expect(auth.logoutCalls).toBe(1);
  });

  it('revokes all active user sessions on logout-all', async () => {
    const { service, auth } = setup();

    await service.logoutAll(TEST_USER_ID, metadata);

    expect(auth.logoutAllCalls).toBe(1);
  });

  it('returns the current safe user with database-backed roles and permissions', async () => {
    const { service } = setup();

    const result = await service.getCurrentUser(TEST_USER_ID);

    expect(result.user.email).toBe('admin@example.com');
    expect(result.roles).toEqual(['ADMIN']);
    expect(result.permissions).toContain('users.read');
    expect(result.user).not.toHaveProperty('credential');
  });

  it('changes the password and revokes other sessions', async () => {
    const { service, auth, users } = setup();

    await service.changePassword(
      TEST_USER_ID,
      TEST_SESSION_ID,
      {
        currentPassword: 'ValidPassword1!',
        newPassword: 'NewValidPassword2@',
      },
      metadata,
    );

    expect(auth.passwordChanges).toBe(1);
    expect(users.user?.credential?.passwordHash).toBe('hashed:NewValidPassword2@');
  });

  it('rejects an incorrect current password', async () => {
    const { service } = setup();

    await expectAppError(
      service.changePassword(
        TEST_USER_ID,
        TEST_SESSION_ID,
        {
          currentPassword: 'WrongPassword1!',
          newPassword: 'NewValidPassword2@',
        },
        metadata,
      ),
      'CURRENT_PASSWORD_INCORRECT',
    );
  });
});
