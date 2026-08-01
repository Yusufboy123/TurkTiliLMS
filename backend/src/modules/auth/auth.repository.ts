import type { PrismaClient, SessionClientType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { RequestMetadata } from './auth.types.js';

export class SessionRotationConflictError extends Error {
  constructor() {
    super('The refresh session has already been rotated or revoked.');
    this.name = 'SessionRotationConflictError';
  }
}

export class LoginCredentialConflictError extends Error {
  constructor() {
    super('The credential changed after password verification.');
    this.name = 'LoginCredentialConflictError';
  }
}

export interface SessionForRefresh {
  id: string;
  userId: string;
  tokenFamilyId: string;
  clientType: SessionClientType;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
}

export interface AuthRepository {
  recordFailedLogin(
    userId: string,
    maximumAttempts: number,
    lockedUntil: Date,
    metadata: RequestMetadata,
  ): Promise<void>;
  completeLogin(input: {
    userId: string;
    expectedPasswordHash: string;
    expectedCredentialEpoch: Date;
    refreshTokenHash: string;
    tokenFamilyId: string;
    expiresAt: Date;
    metadata: RequestMetadata;
  }): Promise<string>;
  findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<SessionForRefresh | null>;
  revokeSessionFamilyByRefreshTokenHash(
    refreshTokenHash: string,
    metadata: RequestMetadata,
  ): Promise<void>;
  rotateSession(input: {
    session: SessionForRefresh;
    refreshTokenHash: string;
    metadata: RequestMetadata;
    now: Date;
  }): Promise<string>;
  revokeSessionFamily(
    userId: string,
    tokenFamilyId: string,
    reason: string,
    metadata: RequestMetadata,
    auditAction?: string,
  ): Promise<void>;
  revokeSession(
    userId: string,
    sessionId: string,
    reason: string,
    metadata: RequestMetadata,
  ): Promise<void>;
  revokeAllSessions(userId: string, reason: string, metadata: RequestMetadata): Promise<void>;
  changePassword(input: {
    userId: string;
    currentSessionId: string;
    passwordHash: string;
    metadata: RequestMetadata;
  }): Promise<void>;
}

function metadataFields(metadata: RequestMetadata): {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  clientType: SessionClientType;
} {
  return {
    clientType: metadata.clientType,
    ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
    ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
    ...(metadata.deviceName ? { deviceName: metadata.deviceName } : {}),
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async recordFailedLogin(
    userId: string,
    maximumAttempts: number,
    lockedUntil: Date,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const credential = await transaction.userCredential.update({
        where: { userId },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      const hasReachedLimit = credential.failedLoginCount >= maximumAttempts;

      if (hasReachedLimit) {
        await transaction.userCredential.update({
          where: { userId },
          data: { lockedUntil },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: hasReachedLimit ? 'auth.account_locked' : 'auth.login_failed',
          subjectType: 'user',
          subjectId: userId,
          metadata: {
            failedLoginCount: credential.failedLoginCount,
            clientType: metadata.clientType,
          },
        },
      });
    });
  }

  async completeLogin(input: {
    userId: string;
    expectedPasswordHash: string;
    expectedCredentialEpoch: Date;
    refreshTokenHash: string;
    tokenFamilyId: string;
    expiresAt: Date;
    metadata: RequestMetadata;
  }): Promise<string> {
    return this.client.$transaction(async (transaction) => {
      const databaseClock = await transaction.$queryRaw<{ currentTime: Date }[]>`
        SELECT clock_timestamp() AS "currentTime"
      `;
      const now = databaseClock[0]?.currentTime;
      if (!now) throw new Error('Database timestamp could not be read.');
      const credentialRows = await transaction.$queryRaw<
        { passwordHash: string; credentialEpoch: Date; lockedUntil: Date | null }[]
      >`
        SELECT
          "password_hash" AS "passwordHash",
          "password_changed_at" AS "credentialEpoch",
          "locked_until" AS "lockedUntil"
        FROM "user_credentials"
        WHERE "user_id" = ${input.userId}::uuid
        FOR UPDATE
      `;
      const credential = credentialRows[0];
      if (
        !credential ||
        credential.passwordHash !== input.expectedPasswordHash ||
        credential.credentialEpoch.getTime() !== input.expectedCredentialEpoch.getTime() ||
        (credential.lockedUntil !== null && credential.lockedUntil > now)
      ) {
        throw new LoginCredentialConflictError();
      }
      const session = await transaction.userSession.create({
        data: {
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          tokenFamilyId: input.tokenFamilyId,
          expiresAt: input.expiresAt,
          lastActivityAt: now,
          lastAuthenticatedAt: now,
          ...metadataFields(input.metadata),
        },
        select: { id: true },
      });

      await transaction.user.update({
        where: { id: input.userId },
        data: { lastLoginAt: now },
      });
      await transaction.userCredential.update({
        where: { userId: input.userId },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: 'auth.login_succeeded',
          subjectType: 'user_session',
          subjectId: session.id,
          metadata: { clientType: input.metadata.clientType },
        },
      });

      return session.id;
    });
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<SessionForRefresh | null> {
    return this.client.userSession.findUnique({
      where: { refreshTokenHash },
      select: {
        id: true,
        userId: true,
        tokenFamilyId: true,
        clientType: true,
        expiresAt: true,
        revokedAt: true,
        replacedBySessionId: true,
      },
    });
  }

  async revokeSessionFamilyByRefreshTokenHash(
    refreshTokenHash: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      // Lock the presented session before revoking its family. This serializes
      // logout with refresh rotation so a concurrently created descendant
      // cannot remain active after the browser has logged out.
      const sessions = await transaction.$queryRaw<
        {
          id: string;
          userId: string;
          tokenFamilyId: string;
          clientType: SessionClientType;
        }[]
      >`
        SELECT
          "id",
          "user_id" AS "userId",
          "token_family_id" AS "tokenFamilyId",
          "client_type" AS "clientType"
        FROM "user_sessions"
        WHERE "refresh_token_hash" = ${refreshTokenHash}
        FOR UPDATE
      `;
      const session = sessions[0];
      if (!session) return;

      const now = new Date();
      const result = await transaction.userSession.updateMany({
        where: {
          userId: session.userId,
          tokenFamilyId: session.tokenFamilyId,
          revokedAt: null,
        },
        data: { revokedAt: now, revocationReason: 'logout', lastActivityAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'auth.logout',
          subjectType: 'user_session',
          subjectId: session.id,
          metadata: {
            clientType: session.clientType,
            revokedSessionCount: result.count,
            requestClientType: metadata.clientType,
          },
        },
      });
    });
  }

  async rotateSession(input: {
    session: SessionForRefresh;
    refreshTokenHash: string;
    metadata: RequestMetadata;
    now: Date;
  }): Promise<string> {
    return this.client.$transaction(async (transaction) => {
      const nextSession = await transaction.userSession.create({
        data: {
          userId: input.session.userId,
          refreshTokenHash: input.refreshTokenHash,
          tokenFamilyId: input.session.tokenFamilyId,
          clientType: input.session.clientType,
          expiresAt: input.session.expiresAt,
          lastActivityAt: input.now,
          ...(input.metadata.ipAddress ? { ipAddress: input.metadata.ipAddress } : {}),
          ...(input.metadata.userAgent ? { userAgent: input.metadata.userAgent } : {}),
        },
        select: { id: true },
      });
      const updated = await transaction.userSession.updateMany({
        where: {
          id: input.session.id,
          revokedAt: null,
          replacedBySessionId: null,
          expiresAt: { gt: input.now },
        },
        data: {
          revokedAt: input.now,
          revocationReason: 'rotated',
          replacedBySessionId: nextSession.id,
          lastActivityAt: input.now,
        },
      });

      if (updated.count !== 1) {
        throw new SessionRotationConflictError();
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: input.session.userId,
          action: 'auth.session_refreshed',
          subjectType: 'user_session',
          subjectId: nextSession.id,
          metadata: { previousSessionId: input.session.id },
        },
      });

      return nextSession.id;
    });
  }

  async revokeSessionFamily(
    userId: string,
    tokenFamilyId: string,
    reason: string,
    metadata: RequestMetadata,
    auditAction = 'auth.refresh_token_reuse_detected',
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const now = new Date();
      await transaction.userSession.updateMany({
        where: { userId, tokenFamilyId, revokedAt: null },
        data: { revokedAt: now, revocationReason: reason, lastActivityAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: auditAction,
          subjectType: 'user',
          subjectId: userId,
          metadata: { tokenFamilyId, clientType: metadata.clientType },
        },
      });
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    reason: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const now = new Date();
      await transaction.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now, revocationReason: reason, lastActivityAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'auth.logout',
          subjectType: 'user_session',
          subjectId: sessionId,
          metadata: { clientType: metadata.clientType },
        },
      });
    });
  }

  async revokeAllSessions(
    userId: string,
    reason: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const now = new Date();
      const result = await transaction.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revocationReason: reason, lastActivityAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'auth.logout_all',
          subjectType: 'user',
          subjectId: userId,
          metadata: { revokedSessionCount: result.count, clientType: metadata.clientType },
        },
      });
    });
  }

  async changePassword(input: {
    userId: string;
    currentSessionId: string;
    passwordHash: string;
    metadata: RequestMetadata;
  }): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const now = new Date();
      await transaction.userCredential.update({
        where: { userId: input.userId },
        data: {
          passwordHash: input.passwordHash,
          passwordChangedAt: now,
          requiresPasswordChange: false,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await transaction.userSession.updateMany({
        where: {
          userId: input.userId,
          id: { not: input.currentSessionId },
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: 'password_changed',
          lastActivityAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: 'auth.password_changed',
          subjectType: 'user',
          subjectId: input.userId,
          metadata: { clientType: input.metadata.clientType },
        },
      });
    });
  }
}
