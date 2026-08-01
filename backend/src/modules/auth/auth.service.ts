import { SessionClientType, UserStatus, type RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { SafeUserProfile, UserAccessRecord } from '../users/user.types.js';
import {
  type AuthRepository,
  LoginCredentialConflictError,
  SessionRotationConflictError,
} from './auth.repository.js';
import type {
  AccessTokenService,
  AuthenticationResult,
  PasswordService,
  RefreshTokenService,
  RequestMetadata,
} from './auth.types.js';
import type { ChangePasswordInput, LoginInput, RefreshInput } from './auth.schemas.js';

const INVALID_CREDENTIALS_MESSAGE = 'Email yoki parol noto‘g‘ri.';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Sessiyani yangilash ma’lumoti yaroqsiz.';

export interface AuthenticationConfiguration {
  refreshTokenExpiresInMs: number;
  maximumFailedAttempts: number;
  lockoutDurationMs: number;
}

export interface AuthenticationService {
  login(input: LoginInput, metadata: RequestMetadata): Promise<AuthenticationResult>;
  refresh(input: RefreshInput, metadata: RequestMetadata): Promise<AuthenticationResult>;
  logoutByRefreshToken(refreshToken: string, metadata: RequestMetadata): Promise<void>;
  logout(userId: string, sessionId: string, metadata: RequestMetadata): Promise<void>;
  logoutAll(userId: string, metadata: RequestMetadata): Promise<void>;
  getCurrentUser(userId: string): Promise<{
    user: SafeUserProfile;
    roles: RoleCode[];
    permissions: string[];
  }>;
  changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordInput,
    metadata: RequestMetadata,
  ): Promise<void>;
}

function toSafeUser(user: UserAccessRecord, lastLoginAt = user.lastLoginAt): SafeUserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    lastLoginAt,
  };
}

function invalidCredentialsError(): AppError {
  return new AppError(INVALID_CREDENTIALS_MESSAGE, 401, 'INVALID_CREDENTIALS');
}

function invalidRefreshTokenError(): AppError {
  return new AppError(INVALID_REFRESH_TOKEN_MESSAGE, 401, 'INVALID_REFRESH_TOKEN');
}

function isActiveUser(user: UserAccessRecord): boolean {
  return user.status === UserStatus.ACTIVE && user.deletedAt === null;
}

export class AuthService implements AuthenticationService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly configuration: AuthenticationConfiguration,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(input: LoginInput, metadata: RequestMetadata): Promise<AuthenticationResult> {
    const user = await this.users.findByEmail(input.email);

    if (!user?.credential) {
      await this.passwords.verifyAgainstDummyHash(input.password);
      throw invalidCredentialsError();
    }

    const passwordIsValid = await this.passwords.verify(
      input.password,
      user.credential.passwordHash,
    );
    const now = this.now();

    if (!passwordIsValid) {
      if (
        isActiveUser(user) &&
        (user.credential.lockedUntil === null || user.credential.lockedUntil <= now)
      ) {
        await this.auth.recordFailedLogin(
          user.id,
          this.configuration.maximumFailedAttempts,
          new Date(now.getTime() + this.configuration.lockoutDurationMs),
          metadata,
        );
      }

      throw invalidCredentialsError();
    }

    if (
      !isActiveUser(user) ||
      (user.credential.lockedUntil !== null && user.credential.lockedUntil > now)
    ) {
      throw invalidCredentialsError();
    }

    const refreshToken = this.refreshTokens.generate();
    const refreshTokenExpiresAt = new Date(
      now.getTime() + this.configuration.refreshTokenExpiresInMs,
    );
    let sessionId: string;
    try {
      sessionId = await this.auth.completeLogin({
        userId: user.id,
        expectedPasswordHash: user.credential.passwordHash,
        expectedCredentialEpoch: user.credential.passwordChangedAt,
        refreshTokenHash: this.refreshTokens.hash(refreshToken),
        tokenFamilyId: this.refreshTokens.createFamilyId(),
        expiresAt: refreshTokenExpiresAt,
        metadata: {
          ...metadata,
          clientType: input.clientType,
          ...(input.deviceName ? { deviceName: input.deviceName } : {}),
        },
      });
    } catch (error: unknown) {
      if (error instanceof LoginCredentialConflictError) throw invalidCredentialsError();
      throw error;
    }
    const accessToken = this.accessTokens.sign({
      sub: user.id,
      sessionId,
      roles: user.roles,
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: toSafeUser(user, now),
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  async refresh(input: RefreshInput, metadata: RequestMetadata): Promise<AuthenticationResult> {
    const refreshTokenHash = this.refreshTokens.hash(input.refreshToken);
    const session = await this.auth.findSessionByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw invalidRefreshTokenError();
    }

    const sessionMetadata = { ...metadata, clientType: session.clientType };

    if (session.revokedAt !== null || session.replacedBySessionId !== null) {
      await this.auth.revokeSessionFamily(
        session.userId,
        session.tokenFamilyId,
        'refresh_token_reuse',
        sessionMetadata,
      );
      throw invalidRefreshTokenError();
    }

    const now = this.now();

    if (session.expiresAt <= now) {
      throw invalidRefreshTokenError();
    }

    const user = await this.users.findById(session.userId);

    if (!user || !isActiveUser(user)) {
      await this.auth.revokeSessionFamily(
        session.userId,
        session.tokenFamilyId,
        'account_inactive',
        sessionMetadata,
        'auth.inactive_account_sessions_revoked',
      );
      throw invalidRefreshTokenError();
    }

    const nextRefreshToken = this.refreshTokens.generate();
    let nextSessionId: string;

    try {
      nextSessionId = await this.auth.rotateSession({
        session,
        refreshTokenHash: this.refreshTokens.hash(nextRefreshToken),
        metadata: sessionMetadata,
        now,
      });
    } catch (error: unknown) {
      if (!(error instanceof SessionRotationConflictError)) {
        throw error;
      }

      await this.auth.revokeSessionFamily(
        session.userId,
        session.tokenFamilyId,
        'refresh_token_reuse',
        sessionMetadata,
      );
      throw invalidRefreshTokenError();
    }

    return {
      accessToken: this.accessTokens.sign({
        sub: user.id,
        sessionId: nextSessionId,
        roles: user.roles,
      }),
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      user: toSafeUser(user),
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  async logoutByRefreshToken(refreshToken: string, metadata: RequestMetadata): Promise<void> {
    const refreshTokenHash = this.refreshTokens.hash(refreshToken);
    await this.auth.revokeSessionFamilyByRefreshTokenHash(refreshTokenHash, metadata);
  }

  logout(userId: string, sessionId: string, metadata: RequestMetadata): Promise<void> {
    return this.auth.revokeSession(userId, sessionId, 'logout', metadata);
  }

  logoutAll(userId: string, metadata: RequestMetadata): Promise<void> {
    return this.auth.revokeAllSessions(userId, 'logout_all', metadata);
  }

  async getCurrentUser(userId: string): Promise<{
    user: SafeUserProfile;
    roles: RoleCode[];
    permissions: string[];
  }> {
    const user = await this.users.findById(userId);

    if (!user || !isActiveUser(user)) {
      throw new AppError('Foydalanuvchi sessiyasi yaroqsiz.', 401, 'AUTHENTICATION_REQUIRED');
    }

    return {
      user: toSafeUser(user),
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordInput,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.users.findById(userId);

    if (!user?.credential || !isActiveUser(user)) {
      throw new AppError('Foydalanuvchi sessiyasi yaroqsiz.', 401, 'AUTHENTICATION_REQUIRED');
    }

    const currentPasswordIsValid = await this.passwords.verify(
      input.currentPassword,
      user.credential.passwordHash,
    );

    if (!currentPasswordIsValid) {
      throw new AppError('Joriy parol noto‘g‘ri.', 400, 'CURRENT_PASSWORD_INCORRECT');
    }

    const reusesCurrentPassword = await this.passwords.verify(
      input.newPassword,
      user.credential.passwordHash,
    );

    if (reusesCurrentPassword) {
      throw new AppError(
        'Yangi parol joriy paroldan farq qilishi kerak.',
        422,
        'PASSWORD_REUSE_NOT_ALLOWED',
      );
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.auth.changePassword({
      userId,
      currentSessionId: sessionId,
      passwordHash,
      metadata,
    });
  }
}

export function defaultRequestMetadata(): RequestMetadata {
  return { clientType: SessionClientType.WEB };
}
