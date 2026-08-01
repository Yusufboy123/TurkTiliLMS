import { RoleCode, SessionClientType, UserStatus } from '@prisma/client';
import {
  LoginCredentialConflictError,
  type AuthRepository,
  type SessionForRefresh,
} from '../../src/modules/auth/auth.repository.js';
import type {
  AccessTokenClaims,
  AccessTokenService,
  PasswordService,
  RefreshTokenService,
  RequestMetadata,
} from '../../src/modules/auth/auth.types.js';
import type { UserRepository } from '../../src/modules/users/user.repository.js';
import type { UserAccessRecord } from '../../src/modules/users/user.types.js';
import { AppError } from '../../src/utils/app-error.js';

export const TEST_USER_ID = '019b9e22-7f5d-7d3a-a0f1-ff64c8124a11';
export const TEST_SESSION_ID = '019b9e22-8022-796f-b12a-bb56ba452725';
export const TEST_FAMILY_ID = 'b863b734-1fc5-4a84-a3c6-8b7d05d72f54';

export function createTestUser(overrides: Partial<UserAccessRecord> = {}): UserAccessRecord {
  return {
    id: TEST_USER_ID,
    email: 'admin@example.com',
    firstName: 'Ali',
    lastName: 'Valiyev',
    status: UserStatus.ACTIVE,
    deletedAt: null,
    lastLoginAt: null,
    credential: {
      passwordHash: 'hashed:ValidPassword1!',
      passwordChangedAt: new Date('2026-07-23T10:00:00.000Z'),
      failedLoginCount: 0,
      lockedUntil: null,
      requiresPasswordChange: false,
    },
    roles: [RoleCode.ADMIN],
    permissions: ['users.read', 'users.update'],
    ...overrides,
  };
}

export class FakeUserRepository implements UserRepository {
  constructor(public user: UserAccessRecord | null = createTestUser()) {}

  findByEmail(email: string): Promise<UserAccessRecord | null> {
    return Promise.resolve(this.user?.email === email ? this.user : null);
  }

  findById(userId: string): Promise<UserAccessRecord | null> {
    return Promise.resolve(this.user?.id === userId ? this.user : null);
  }
}

export class FakePasswordService implements PasswordService {
  dummyVerificationCount = 0;

  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }

  verifyAgainstDummyHash(): Promise<void> {
    this.dummyVerificationCount += 1;
    return Promise.resolve();
  }
}

export class FakeAccessTokenService implements AccessTokenService {
  constructor(
    private readonly acceptedClaims: AccessTokenClaims = {
      sub: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      roles: [RoleCode.ADMIN],
    },
  ) {}

  sign(claims: AccessTokenClaims): string {
    return `access:${claims.sessionId}`;
  }

  verify(token: string): AccessTokenClaims {
    if (token !== 'valid-access-token') {
      throw new AppError(
        'Kirish sessiyasi yaroqsiz yoki muddati tugagan.',
        401,
        'INVALID_ACCESS_TOKEN',
      );
    }

    return this.acceptedClaims;
  }
}

export class FakeRefreshTokenService implements RefreshTokenService {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `refresh-token-${this.counter}-with-sufficient-test-length`;
  }

  hash(token: string): string {
    return `hash:${token}`;
  }

  createFamilyId(): string {
    return TEST_FAMILY_ID;
  }
}

interface StoredSession extends SessionForRefresh {
  refreshTokenHash: string;
}

export class FakeAuthRepository implements AuthRepository {
  readonly sessions = new Map<string, StoredSession>();
  logoutCalls = 0;
  logoutAllCalls = 0;
  passwordChanges = 0;
  reuseDetections = 0;
  rejectLoginForCredentialConflict = false;

  constructor(private readonly users: FakeUserRepository) {}

  recordFailedLogin(
    _userId: string,
    maximumAttempts: number,
    lockedUntil: Date,
    _metadata: RequestMetadata,
  ): Promise<void> {
    const credential = this.users.user?.credential;

    if (credential) {
      credential.failedLoginCount += 1;

      if (credential.failedLoginCount >= maximumAttempts) {
        credential.lockedUntil = lockedUntil;
      }
    }

    return Promise.resolve();
  }

  completeLogin(input: {
    userId: string;
    expectedPasswordHash: string;
    expectedCredentialEpoch: Date;
    refreshTokenHash: string;
    tokenFamilyId: string;
    expiresAt: Date;
    metadata: RequestMetadata;
  }): Promise<string> {
    if (this.rejectLoginForCredentialConflict) {
      throw new LoginCredentialConflictError();
    }
    const session: StoredSession = {
      id: TEST_SESSION_ID,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      tokenFamilyId: input.tokenFamilyId,
      clientType: input.metadata.clientType,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedBySessionId: null,
    };
    this.sessions.set(input.refreshTokenHash, session);

    if (this.users.user?.credential) {
      this.users.user.credential.failedLoginCount = 0;
      this.users.user.credential.lockedUntil = null;
    }

    return Promise.resolve(session.id);
  }

  findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<SessionForRefresh | null> {
    return Promise.resolve(this.sessions.get(refreshTokenHash) ?? null);
  }

  revokeSessionFamilyByRefreshTokenHash(
    refreshTokenHash: string,
    _metadata: RequestMetadata,
  ): Promise<void> {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === refreshTokenHash,
    );
    if (!session) return Promise.resolve();

    for (const candidate of this.sessions.values()) {
      if (
        candidate.userId === session.userId &&
        candidate.tokenFamilyId === session.tokenFamilyId &&
        candidate.revokedAt === null
      ) {
        candidate.revokedAt = new Date();
      }
    }
    this.logoutCalls += 1;
    return Promise.resolve();
  }

  rotateSession(input: {
    session: SessionForRefresh;
    refreshTokenHash: string;
    metadata: RequestMetadata;
    now: Date;
  }): Promise<string> {
    const current = [...this.sessions.values()].find((session) => session.id === input.session.id);

    if (!current || current.revokedAt || current.replacedBySessionId) {
      throw new Error('Rotation conflict');
    }

    const nextId = '019b9e22-8f9c-771a-9753-67ad8f179af2';
    current.revokedAt = input.now;
    current.replacedBySessionId = nextId;
    this.sessions.set(input.refreshTokenHash, {
      id: nextId,
      userId: current.userId,
      refreshTokenHash: input.refreshTokenHash,
      tokenFamilyId: current.tokenFamilyId,
      clientType: current.clientType,
      expiresAt: current.expiresAt,
      revokedAt: null,
      replacedBySessionId: null,
    });

    return Promise.resolve(nextId);
  }

  revokeSessionFamily(
    userId: string,
    tokenFamilyId: string,
    _reason: string,
    _metadata: RequestMetadata,
    _auditAction?: string,
  ): Promise<void> {
    this.reuseDetections += 1;

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.tokenFamilyId === tokenFamilyId) {
        session.revokedAt ??= new Date();
      }
    }

    return Promise.resolve();
  }

  revokeSession(
    userId: string,
    sessionId: string,
    _reason: string,
    _metadata: RequestMetadata,
  ): Promise<void> {
    this.logoutCalls += 1;

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.id === sessionId) {
        session.revokedAt = new Date();
      }
    }

    return Promise.resolve();
  }

  revokeAllSessions(userId: string, _reason: string, _metadata: RequestMetadata): Promise<void> {
    this.logoutAllCalls += 1;

    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.revokedAt = new Date();
      }
    }

    return Promise.resolve();
  }

  changePassword(input: {
    userId: string;
    currentSessionId: string;
    passwordHash: string;
    metadata: RequestMetadata;
  }): Promise<void> {
    this.passwordChanges += 1;

    if (this.users.user?.credential) {
      this.users.user.credential.passwordHash = input.passwordHash;
      this.users.user.credential.requiresPasswordChange = false;
    }

    for (const session of this.sessions.values()) {
      if (session.userId === input.userId && session.id !== input.currentSessionId) {
        session.revokedAt = new Date();
      }
    }

    return Promise.resolve();
  }

  addRefreshSession(
    refreshToken: string,
    refreshTokens: RefreshTokenService,
    overrides: Partial<StoredSession> = {},
  ): StoredSession {
    const session: StoredSession = {
      id: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      refreshTokenHash: refreshTokens.hash(refreshToken),
      tokenFamilyId: TEST_FAMILY_ID,
      clientType: SessionClientType.WEB,
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      revokedAt: null,
      replacedBySessionId: null,
      ...overrides,
    };
    this.sessions.set(session.refreshTokenHash, session);
    return session;
  }
}
