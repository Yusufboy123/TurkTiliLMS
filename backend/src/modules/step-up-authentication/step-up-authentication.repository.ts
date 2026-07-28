import {
  Prisma,
  UserStatus,
  type PrismaClient,
  type StepUpAction,
  type StepUpContinuation,
  type StepUpTargetType,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { StepUpTransactionConflictError } from './step-up-authentication.errors.js';
import type {
  StepUpAuditContext,
  StepUpChallengeRecord,
  StepUpProofRecord,
  StepUpSecurityContext,
} from './step-up-authentication.types.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

const challengeSelect = {
  id: true,
  userId: true,
  sessionId: true,
  credentialEpoch: true,
  action: true,
  targetType: true,
  targetId: true,
  continuation: true,
  continuationId: true,
  attemptCount: true,
  expiresAt: true,
  verifiedAt: true,
  lockedAt: true,
} satisfies Prisma.StepUpChallengeSelect;

const proofSelect = {
  id: true,
  challengeId: true,
  userId: true,
  sessionId: true,
  credentialEpoch: true,
  action: true,
  targetType: true,
  targetId: true,
  expiresAt: true,
  consumedAt: true,
  challenge: {
    select: {
      verifiedAt: true,
      lockedAt: true,
      expiresAt: true,
    },
  },
} satisfies Prisma.StepUpProofSelect;

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  return error.code === 'P2010' && error.meta?.code === '40001';
}

function auditFields(context: StepUpAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

export class StepUpStateConflictError extends Error {
  constructor() {
    super('Step-up security state changed concurrently.');
    this.name = 'StepUpStateConflictError';
  }
}

export interface CreateChallengeData {
  userId: string;
  sessionId: string;
  nonceHash: string;
  credentialEpoch: Date;
  action: StepUpAction;
  targetType: StepUpTargetType;
  targetId: string;
  continuation: StepUpContinuation;
  continuationId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateProofData {
  challenge: StepUpChallengeRecord;
  proofHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface StepUpTransactionRepository {
  getDatabaseTimestamp(): Promise<Date>;
  lockRateLimitScope(scope: string): Promise<void>;
  lockSecurityState(userId: string, sessionId: string): Promise<void>;
  lockTarget(action: StepUpAction, targetId: string): Promise<void>;
  lockChallenge(challengeId: string): Promise<void>;
  lockProofByHash(proofHash: string): Promise<void>;
  findSecurityContext(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<StepUpSecurityContext | null>;
  targetExists(action: StepUpAction, targetId: string): Promise<boolean>;
  countChallengesSince(userId: string, sessionId: string, since: Date): Promise<number>;
  countVerificationAttemptsSince(userId: string, since: Date): Promise<number>;
  findChallenge(
    challengeId: string,
    userId: string,
    sessionId: string,
  ): Promise<StepUpChallengeRecord | null>;
  createChallenge(data: CreateChallengeData): Promise<StepUpChallengeRecord>;
  incrementFailedAttempt(
    challengeId: string,
    expectedAttemptCount: number,
    nextAttemptCount: number,
    lockedAt: Date | null,
  ): Promise<void>;
  verifyChallengeAndCreateProof(data: CreateProofData): Promise<void>;
  findProofByHash(proofHash: string): Promise<StepUpProofRecord | null>;
  consumeProof(proofId: string, consumedAt: Date): Promise<void>;
  createAudit(input: {
    action: string;
    subjectType: string;
    subjectId: string;
    metadata: Prisma.InputJsonObject;
    context: StepUpAuditContext;
  }): Promise<void>;
}

export interface StepUpRepository {
  withSerializableTransaction<T>(
    operation: (transaction: StepUpTransactionRepository) => Promise<T>,
  ): Promise<T>;
  findChallengeSnapshot(
    challengeId: string,
    userId: string,
    sessionId: string,
  ): Promise<{
    challenge: StepUpChallengeRecord;
    security: StepUpSecurityContext;
    databaseTime: Date;
  } | null>;
  recordFailureAudit(input: {
    challenge: StepUpChallengeRecord | null;
    challengeId: string;
    reason: string;
    attemptCount: number;
    context: StepUpAuditContext;
  }): Promise<void>;
}

export class PrismaStepUpTransactionRepository implements StepUpTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async getDatabaseTimestamp(): Promise<Date> {
    const rows = await this.transaction.$queryRaw<{ currentTime: Date }[]>`
      SELECT clock_timestamp() AS "currentTime"
    `;
    const currentTime = rows[0]?.currentTime;
    if (!currentTime) throw new Error('Database timestamp could not be read.');
    return currentTime;
  }

  async lockRateLimitScope(scope: string): Promise<void> {
    const rows = await this.transaction.$queryRaw<{ lockAcquired: number }[]>`
      WITH "rate_limit_lock" AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))
      )
      SELECT 1::INTEGER AS "lockAcquired"
      FROM "rate_limit_lock"
    `;
    if (rows[0]?.lockAcquired !== 1) throw new Error('Rate-limit lock could not be acquired.');
  }

  async lockSecurityState(userId: string, sessionId: string): Promise<void> {
    // The protected-operation lock order begins with the session, then the
    // proof and domain target. Credential/RBAC rows are locked immediately
    // after the session so their authorization snapshot cannot change.
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "user_sessions"
      WHERE "id" = ${sessionId}::uuid
        AND "user_id" = ${userId}::uuid
      FOR UPDATE
    `;
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "users"
      WHERE "id" = ${userId}::uuid
      FOR SHARE
    `;
    await this.transaction.$queryRaw`
      SELECT "user_id"
      FROM "user_credentials"
      WHERE "user_id" = ${userId}::uuid
      FOR SHARE
    `;
    await this.transaction.$queryRaw`
      SELECT ur."user_id"
      FROM "user_roles" AS ur
      INNER JOIN "roles" AS r ON r."id" = ur."role_id"
      WHERE ur."user_id" = ${userId}::uuid
      FOR SHARE OF ur, r
    `;
    await this.transaction.$queryRaw`
      SELECT rp."role_id"
      FROM "role_permissions" AS rp
      INNER JOIN "user_roles" AS ur ON ur."role_id" = rp."role_id"
      WHERE ur."user_id" = ${userId}::uuid
      FOR SHARE OF rp
    `;
  }

  async lockTarget(action: StepUpAction, targetId: string): Promise<void> {
    if (action === 'CERTIFICATE_ISSUE') {
      await this.transaction.$queryRaw`
        SELECT "id"
        FROM "course_enrollments"
        WHERE "id" = ${targetId}::uuid
        FOR SHARE
      `;
      return;
    }
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "certificates"
      WHERE "id" = ${targetId}::uuid
      FOR SHARE
    `;
  }

  async lockChallenge(challengeId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "step_up_challenges"
      WHERE "id" = ${challengeId}::uuid
      FOR UPDATE
    `;
  }

  async lockProofByHash(proofHash: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "step_up_proofs"
      WHERE "proof_hash" = ${proofHash}
      FOR UPDATE
    `;
  }

  async findSecurityContext(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<StepUpSecurityContext | null> {
    const session = await this.transaction.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: { gt: now },
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        userId: true,
        lastAuthenticatedAt: true,
        user: {
          select: {
            credential: {
              select: {
                passwordHash: true,
                passwordChangedAt: true,
                requiresPasswordChange: true,
                lockedUntil: true,
              },
            },
            roles: {
              select: {
                expiresAt: true,
                role: {
                  select: {
                    code: true,
                    permissions: {
                      select: { permission: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const credential = session?.user.credential;
    if (!session || !credential) return null;
    const activeAssignments = session.user.roles.filter(
      ({ expiresAt }) => expiresAt === null || expiresAt > now,
    );

    return {
      userId: session.userId,
      sessionId: session.id,
      passwordHash: credential.passwordHash,
      credentialEpoch: credential.passwordChangedAt,
      requiresPasswordChange: credential.requiresPasswordChange,
      credentialLockedUntil: credential.lockedUntil,
      lastAuthenticatedAt: session.lastAuthenticatedAt,
      roles: [...new Set(activeAssignments.map(({ role }) => role.code))],
      permissions: [
        ...new Set(
          activeAssignments.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
    };
  }

  async targetExists(action: StepUpAction, targetId: string): Promise<boolean> {
    if (action === 'CERTIFICATE_ISSUE') {
      return (
        (await this.transaction.courseEnrollment.count({
          where: { id: targetId },
        })) === 1
      );
    }
    return (await this.transaction.certificate.count({ where: { id: targetId } })) === 1;
  }

  countChallengesSince(userId: string, sessionId: string, since: Date): Promise<number> {
    return this.transaction.stepUpChallenge.count({
      where: { userId, sessionId, createdAt: { gte: since } },
    });
  }

  async countVerificationAttemptsSince(userId: string, since: Date): Promise<number> {
    const [failureAggregate, failedAttempts, successfulAttempts] = await Promise.all([
      this.transaction.stepUpChallenge.aggregate({
        where: { userId, createdAt: { gte: since } },
        _sum: { attemptCount: true },
      }),
      this.transaction.auditLog.count({
        where: {
          actorUserId: userId,
          action: 'security.step_up.failed',
          occurredAt: { gte: since },
        },
      }),
      this.transaction.auditLog.count({
        where: {
          actorUserId: userId,
          action: 'security.step_up.succeeded',
          occurredAt: { gte: since },
        },
      }),
    ]);
    // The challenge aggregate is a fail-safe when a denied-attempt audit could
    // not be persisted. Audit timestamps preserve the exact rolling window.
    return Math.max(failureAggregate._sum.attemptCount ?? 0, failedAttempts) + successfulAttempts;
  }

  findChallenge(
    challengeId: string,
    userId: string,
    sessionId: string,
  ): Promise<StepUpChallengeRecord | null> {
    return this.transaction.stepUpChallenge.findFirst({
      where: { id: challengeId, userId, sessionId },
      select: challengeSelect,
    });
  }

  createChallenge(data: CreateChallengeData): Promise<StepUpChallengeRecord> {
    return this.transaction.stepUpChallenge.create({
      data,
      select: challengeSelect,
    });
  }

  async incrementFailedAttempt(
    challengeId: string,
    expectedAttemptCount: number,
    nextAttemptCount: number,
    lockedAt: Date | null,
  ): Promise<void> {
    const updated = await this.transaction.stepUpChallenge.updateMany({
      where: {
        id: challengeId,
        attemptCount: expectedAttemptCount,
        verifiedAt: null,
        lockedAt: null,
      },
      data: {
        attemptCount: nextAttemptCount,
        ...(lockedAt ? { lockedAt } : {}),
      },
    });
    if (updated.count !== 1) throw new StepUpStateConflictError();
  }

  async verifyChallengeAndCreateProof(data: CreateProofData): Promise<void> {
    const verified = await this.transaction.stepUpChallenge.updateMany({
      where: {
        id: data.challenge.id,
        userId: data.challenge.userId,
        sessionId: data.challenge.sessionId,
        attemptCount: data.challenge.attemptCount,
        verifiedAt: null,
        lockedAt: null,
        expiresAt: { gt: data.createdAt },
      },
      data: { verifiedAt: data.createdAt },
    });
    if (verified.count !== 1) throw new StepUpStateConflictError();

    await this.transaction.stepUpProof.create({
      data: {
        challengeId: data.challenge.id,
        userId: data.challenge.userId,
        sessionId: data.challenge.sessionId,
        proofHash: data.proofHash,
        credentialEpoch: data.challenge.credentialEpoch,
        action: data.challenge.action,
        targetType: data.challenge.targetType,
        targetId: data.challenge.targetId,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
      },
    });

    const session = await this.transaction.userSession.updateMany({
      where: {
        id: data.challenge.sessionId,
        userId: data.challenge.userId,
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: { gt: data.createdAt },
      },
      data: { lastAuthenticatedAt: data.createdAt },
    });
    if (session.count !== 1) throw new StepUpStateConflictError();
  }

  findProofByHash(proofHash: string): Promise<StepUpProofRecord | null> {
    return this.transaction.stepUpProof.findUnique({
      where: { proofHash },
      select: proofSelect,
    });
  }

  async consumeProof(proofId: string, consumedAt: Date): Promise<void> {
    const consumed = await this.transaction.stepUpProof.updateMany({
      where: { id: proofId, consumedAt: null, expiresAt: { gt: consumedAt } },
      data: { consumedAt },
    });
    if (consumed.count !== 1) throw new StepUpStateConflictError();
  }

  async createAudit(input: {
    action: string;
    subjectType: string;
    subjectId: string;
    metadata: Prisma.InputJsonObject;
    context: StepUpAuditContext;
  }): Promise<void> {
    await this.transaction.auditLog.create({
      data: {
        ...auditFields(input.context),
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        metadata: input.metadata,
      },
    });
  }
}

export class PrismaStepUpRepository implements StepUpRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async withSerializableTransaction<T>(
    operation: (transaction: StepUpTransactionRepository) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.client.$transaction(
          (transaction) => operation(new PrismaStepUpTransactionRepository(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (!isSerializationConflict(error)) throw error;
        if (attempt === MAX_TRANSACTION_ATTEMPTS) throw new StepUpTransactionConflictError();
      }
    }
    throw new StepUpTransactionConflictError();
  }

  async findChallengeSnapshot(
    challengeId: string,
    userId: string,
    sessionId: string,
  ): Promise<{
    challenge: StepUpChallengeRecord;
    security: StepUpSecurityContext;
    databaseTime: Date;
  } | null> {
    return this.client.$transaction(async (transaction) => {
      const adapter = new PrismaStepUpTransactionRepository(transaction);
      const databaseTime = await adapter.getDatabaseTimestamp();
      const [challenge, security] = await Promise.all([
        adapter.findChallenge(challengeId, userId, sessionId),
        adapter.findSecurityContext(userId, sessionId, databaseTime),
      ]);
      return challenge && security ? { challenge, security, databaseTime } : null;
    });
  }

  async recordFailureAudit(input: {
    challenge: StepUpChallengeRecord | null;
    challengeId: string;
    reason: string;
    attemptCount: number;
    context: StepUpAuditContext;
  }): Promise<void> {
    await this.client.auditLog.create({
      data: {
        ...auditFields(input.context),
        action: 'security.step_up.failed',
        subjectType: 'step_up_challenge',
        subjectId: input.challengeId,
        metadata: {
          ...(input.challenge
            ? {
                action: input.challenge.action,
                targetType: input.challenge.targetType,
                targetId: input.challenge.targetId,
                sessionId: input.challenge.sessionId,
              }
            : {}),
          challengeId: input.challengeId,
          result: 'denied',
          reason: input.reason,
          attemptCount: input.attemptCount,
        },
      },
    });
  }
}
