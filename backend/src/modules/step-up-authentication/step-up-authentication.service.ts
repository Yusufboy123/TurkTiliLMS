import { RoleCode, StepUpAction } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import type { PasswordService } from '../auth/auth.types.js';
import type { StepUpCryptoService } from './step-up-crypto.service.js';
import {
  stepUpAccessDenied,
  stepUpProofExpired,
  stepUpProofInvalid,
  stepUpRateLimited,
  stepUpRequired,
  StepUpTransactionConflictError,
  stepUpVerificationFailed,
} from './step-up-authentication.errors.js';
import {
  StepUpStateConflictError,
  type StepUpRepository,
  type StepUpTransactionRepository,
} from './step-up-authentication.repository.js';
import {
  createStepUpChallengeSchema,
  rawStepUpProofSchema,
  verifyStepUpChallengeSchema,
  type CreateStepUpChallengeInput,
  type VerifyStepUpChallengeInput,
} from './step-up-authentication.schemas.js';
import type {
  ConsumedStepUpProof,
  ConsumeStepUpProofInput,
  StepUpActor,
  StepUpAuditContext,
  StepUpChallengeDto,
  StepUpChallengeRecord,
  StepUpProofDto,
  StepUpSecurityContext,
} from './step-up-authentication.types.js';

const CHALLENGE_LIFETIME_MS = 5 * 60_000;
const PROOF_LIFETIME_MS = 2 * 60_000;
const RECENT_AUTH_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const CHALLENGE_RATE_LIMIT = 5;
const VERIFICATION_RATE_LIMIT = 10;
const MAXIMUM_FAILED_ATTEMPTS = 5;

function requiredPermission(action: StepUpAction): string {
  return action === StepUpAction.CERTIFICATE_ISSUE ? 'certificates.issue' : 'certificates.revoke';
}

function hasPolicy(
  roles: readonly RoleCode[],
  permissions: readonly string[],
  action: StepUpAction,
): boolean {
  return roles.includes(RoleCode.ADMIN) && permissions.includes(requiredPermission(action));
}

function assertActorPolicy(actor: StepUpActor, action: StepUpAction): void {
  if (!hasPolicy(actor.roles, actor.permissions, action)) throw stepUpAccessDenied();
}

function assertCurrentPolicy(security: StepUpSecurityContext, action: StepUpAction): void {
  if (!hasPolicy(security.roles, security.permissions, action)) throw stepUpAccessDenied();
}

function hasUsableCredential(security: StepUpSecurityContext, now: Date): boolean {
  return (
    !security.requiresPasswordChange &&
    (security.credentialLockedUntil === null || security.credentialLockedUntil <= now)
  );
}

function isRecentAuthentication(security: StepUpSecurityContext, now: Date): boolean {
  return (
    security.lastAuthenticatedAt !== null &&
    security.lastAuthenticatedAt <= now &&
    security.lastAuthenticatedAt >= security.credentialEpoch &&
    security.lastAuthenticatedAt.getTime() >= now.getTime() - RECENT_AUTH_WINDOW_MS
  );
}

function sameTimestamp(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function assertChallengeUsable(
  challenge: StepUpChallengeRecord,
  security: StepUpSecurityContext,
  now: Date,
): void {
  if (challenge.verifiedAt !== null || challenge.lockedAt !== null) {
    throw stepUpVerificationFailed();
  }
  if (challenge.expiresAt <= now) throw stepUpProofExpired();
  if (!sameTimestamp(challenge.credentialEpoch, security.credentialEpoch)) {
    throw stepUpProofInvalid();
  }
  if (!hasUsableCredential(security, now)) throw stepUpProofInvalid();
  assertCurrentPolicy(security, challenge.action);
}

function challengeAuditMetadata(
  challenge: StepUpChallengeRecord,
  result: string,
): Record<string, string | number> {
  return {
    action: challenge.action,
    targetType: challenge.targetType,
    targetId: challenge.targetId,
    sessionId: challenge.sessionId,
    challengeId: challenge.id,
    result,
  };
}

function reportFailureAuditProblem(): void {
  process.stderr.write(
    '[security] security.step_up.failed audit persistence failed; verification remained denied.\n',
  );
}

function verificationFailureReason(error: unknown): string {
  if (!(error instanceof AppError)) return 'security_state_changed';
  switch (error.code) {
    case 'ACCESS_DENIED':
      return 'access_denied';
    case 'RATE_LIMIT_EXCEEDED':
      return 'rate_limited';
    case 'STEP_UP_PROOF_EXPIRED':
      return 'challenge_expired';
    case 'STEP_UP_REQUIRED':
      return 'recent_authentication_required';
    case 'STEP_UP_VERIFICATION_FAILED':
      return 'challenge_unavailable';
    default:
      return 'security_state_changed';
  }
}

export interface StepUpAuthenticationUseCases {
  createChallenge(
    input: CreateStepUpChallengeInput,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<StepUpChallengeDto>;
  verifyChallenge(
    challengeId: string,
    input: VerifyStepUpChallengeInput,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<StepUpProofDto>;
  consumeProof(
    transaction: StepUpTransactionRepository,
    input: ConsumeStepUpProofInput,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<ConsumedStepUpProof>;
}

export class StepUpAuthenticationService implements StepUpAuthenticationUseCases {
  constructor(
    private readonly repository: StepUpRepository,
    private readonly passwords: PasswordService,
    private readonly crypto: StepUpCryptoService,
  ) {}

  async createChallenge(
    input: CreateStepUpChallengeInput,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<StepUpChallengeDto> {
    const validatedInput = createStepUpChallengeSchema.parse(input);
    assertActorPolicy(actor, validatedInput.action);

    return this.repository.withSerializableTransaction(async (transaction) => {
      const now = await transaction.getDatabaseTimestamp();
      await transaction.lockRateLimitScope(`step-up:create:${actor.userId}:${actor.sessionId}`);
      await transaction.lockSecurityState(actor.userId, actor.sessionId);
      await transaction.lockTarget(validatedInput.action, validatedInput.targetId);

      const security = await transaction.findSecurityContext(actor.userId, actor.sessionId, now);
      if (!security || !hasUsableCredential(security, now)) throw stepUpAccessDenied();
      assertCurrentPolicy(security, validatedInput.action);
      if (!(await transaction.targetExists(validatedInput.action, validatedInput.targetId))) {
        throw stepUpAccessDenied();
      }

      const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
      if (
        (await transaction.countChallengesSince(actor.userId, actor.sessionId, since)) >=
        CHALLENGE_RATE_LIMIT
      ) {
        throw stepUpRateLimited();
      }

      const nonce = this.crypto.generateSecret();
      const challenge = await transaction.createChallenge({
        userId: actor.userId,
        sessionId: actor.sessionId,
        nonceHash: this.crypto.hash(nonce),
        credentialEpoch: security.credentialEpoch,
        action: validatedInput.action,
        targetType: validatedInput.targetType,
        targetId: validatedInput.targetId,
        continuation: validatedInput.continuation,
        continuationId: randomUUID(),
        expiresAt: new Date(now.getTime() + CHALLENGE_LIFETIME_MS),
        createdAt: now,
      });
      await transaction.createAudit({
        action: 'security.step_up.challenge_created',
        subjectType: 'step_up_challenge',
        subjectId: challenge.id,
        context: audit,
        metadata: {
          ...challengeAuditMetadata(challenge, 'created'),
          expiresAt: challenge.expiresAt.toISOString(),
        },
      });

      return {
        id: challenge.id,
        action: challenge.action,
        targetType: challenge.targetType,
        targetId: challenge.targetId,
        verificationRequired: !isRecentAuthentication(security, now),
        expiresAt: challenge.expiresAt.toISOString(),
        continuationId: challenge.continuationId,
      };
    });
  }

  async verifyChallenge(
    challengeId: string,
    input: VerifyStepUpChallengeInput,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<StepUpProofDto> {
    const validatedInput = verifyStepUpChallengeSchema.parse(input);
    const snapshot = await this.repository.findChallengeSnapshot(
      challengeId,
      actor.userId,
      actor.sessionId,
    );
    if (!snapshot) {
      await this.recordDeniedVerification(null, challengeId, audit, 'challenge_unavailable', 0);
      throw stepUpVerificationFailed();
    }
    try {
      assertActorPolicy(actor, snapshot.challenge.action);
      assertChallengeUsable(snapshot.challenge, snapshot.security, snapshot.databaseTime);
    } catch (error: unknown) {
      await this.recordDeniedVerification(
        snapshot.challenge,
        challengeId,
        audit,
        verificationFailureReason(error),
        snapshot.challenge.attemptCount,
      );
      throw error;
    }

    let passwordVerified = false;
    if (validatedInput.password !== undefined) {
      passwordVerified = await this.passwords.verify(
        validatedInput.password,
        snapshot.security.passwordHash,
      );
    } else if (!isRecentAuthentication(snapshot.security, snapshot.databaseTime)) {
      await this.recordDeniedVerification(
        snapshot.challenge,
        challengeId,
        audit,
        'recent_authentication_required',
        snapshot.challenge.attemptCount,
      );
      throw stepUpRequired();
    }

    if (validatedInput.password !== undefined && !passwordVerified) {
      try {
        await this.recordFailedVerification(snapshot.challenge, actor, audit);
      } catch (error: unknown) {
        if (error instanceof AppError) {
          await this.recordDeniedVerification(
            snapshot.challenge,
            challengeId,
            audit,
            verificationFailureReason(error),
            snapshot.challenge.attemptCount,
          );
        }
        throw error;
      }
      throw stepUpVerificationFailed();
    }

    const rawProof = this.crypto.generateSecret();
    const proofHash = this.crypto.hash(rawProof);

    try {
      return await this.repository.withSerializableTransaction(async (transaction) => {
        const now = await transaction.getDatabaseTimestamp();
        await transaction.lockRateLimitScope(`step-up:verify:${actor.userId}`);
        await transaction.lockSecurityState(actor.userId, actor.sessionId);
        await transaction.lockChallenge(challengeId);

        const security = await transaction.findSecurityContext(actor.userId, actor.sessionId, now);
        const challenge = await transaction.findChallenge(
          challengeId,
          actor.userId,
          actor.sessionId,
        );
        if (!security || !challenge) throw stepUpVerificationFailed();
        assertChallengeUsable(challenge, security, now);
        if (
          !sameTimestamp(snapshot.security.credentialEpoch, security.credentialEpoch) ||
          snapshot.security.passwordHash !== security.passwordHash
        ) {
          throw stepUpProofInvalid();
        }
        if (validatedInput.confirmRecentAuthentication && !isRecentAuthentication(security, now)) {
          throw stepUpRequired();
        }

        const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
        if (
          (await transaction.countVerificationAttemptsSince(actor.userId, since)) >=
          VERIFICATION_RATE_LIMIT
        ) {
          throw stepUpRateLimited();
        }

        await transaction.lockTarget(challenge.action, challenge.targetId);
        if (!(await transaction.targetExists(challenge.action, challenge.targetId))) {
          throw stepUpAccessDenied();
        }

        const expiresAt = new Date(
          Math.min(now.getTime() + PROOF_LIFETIME_MS, challenge.expiresAt.getTime()),
        );
        await transaction.verifyChallengeAndCreateProof({
          challenge,
          proofHash,
          createdAt: now,
          expiresAt,
        });
        await transaction.createAudit({
          action: 'security.step_up.succeeded',
          subjectType: 'step_up_challenge',
          subjectId: challenge.id,
          context: audit,
          metadata: {
            ...challengeAuditMetadata(challenge, 'succeeded'),
            method: validatedInput.password !== undefined ? 'password' : 'recent_authentication',
          },
        });

        return {
          proof: rawProof,
          expiresAt: expiresAt.toISOString(),
          action: challenge.action,
          targetType: challenge.targetType,
          targetId: challenge.targetId,
          continuationId: challenge.continuationId,
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof StepUpStateConflictError ||
        error instanceof StepUpTransactionConflictError
      ) {
        await this.recordDeniedVerification(
          snapshot.challenge,
          challengeId,
          audit,
          'state_conflict',
          snapshot.challenge.attemptCount,
        );
        throw stepUpVerificationFailed();
      }
      if (error instanceof AppError) {
        await this.recordDeniedVerification(
          snapshot.challenge,
          challengeId,
          audit,
          verificationFailureReason(error),
          snapshot.challenge.attemptCount,
        );
      }
      throw error;
    }
  }

  async consumeProof(
    transaction: StepUpTransactionRepository,
    input: ConsumeStepUpProofInput,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<ConsumedStepUpProof> {
    if (!rawStepUpProofSchema.safeParse(input.proof).success) throw stepUpProofInvalid();
    assertActorPolicy(actor, input.action);
    const proofHash = this.crypto.hash(input.proof);
    const now = await transaction.getDatabaseTimestamp();

    await transaction.lockSecurityState(actor.userId, actor.sessionId);
    await transaction.lockProofByHash(proofHash);
    const proof = await transaction.findProofByHash(proofHash);
    if (
      !proof ||
      proof.userId !== actor.userId ||
      proof.sessionId !== actor.sessionId ||
      proof.action !== input.action ||
      proof.targetType !== input.targetType ||
      proof.targetId !== input.targetId
    ) {
      throw stepUpProofInvalid();
    }
    if (proof.expiresAt <= now || proof.challenge.expiresAt <= now) {
      throw stepUpProofExpired();
    }
    if (
      proof.consumedAt !== null ||
      proof.challenge.verifiedAt === null ||
      proof.challenge.lockedAt !== null
    ) {
      throw stepUpProofInvalid();
    }

    const security = await transaction.findSecurityContext(actor.userId, actor.sessionId, now);
    if (!security || !sameTimestamp(proof.credentialEpoch, security.credentialEpoch)) {
      throw stepUpProofInvalid();
    }
    assertCurrentPolicy(security, proof.action);
    await transaction.lockTarget(proof.action, proof.targetId);
    if (!(await transaction.targetExists(proof.action, proof.targetId))) {
      throw stepUpProofInvalid();
    }

    try {
      await transaction.consumeProof(proof.id, now);
    } catch (error: unknown) {
      if (error instanceof StepUpStateConflictError) throw stepUpProofInvalid();
      throw error;
    }
    await transaction.createAudit({
      action: 'security.step_up.proof_consumed',
      subjectType: 'step_up_proof',
      subjectId: proof.id,
      context: audit,
      metadata: {
        challengeId: proof.challengeId,
        action: proof.action,
        targetType: proof.targetType,
        targetId: proof.targetId,
        sessionId: proof.sessionId,
        result: 'consumed',
      },
    });

    return { proofId: proof.id, challengeId: proof.challengeId, consumedAt: now };
  }

  private async recordFailedVerification(
    snapshotChallenge: StepUpChallengeRecord,
    actor: StepUpActor,
    audit: StepUpAuditContext,
  ): Promise<void> {
    let attemptCount = snapshotChallenge.attemptCount;
    let challengeForAudit = snapshotChallenge;
    try {
      const result = await this.repository.withSerializableTransaction(async (transaction) => {
        const now = await transaction.getDatabaseTimestamp();
        await transaction.lockRateLimitScope(`step-up:verify:${actor.userId}`);
        await transaction.lockSecurityState(actor.userId, actor.sessionId);
        await transaction.lockChallenge(snapshotChallenge.id);
        const security = await transaction.findSecurityContext(actor.userId, actor.sessionId, now);
        const challenge = await transaction.findChallenge(
          snapshotChallenge.id,
          actor.userId,
          actor.sessionId,
        );
        if (!security || !challenge) throw stepUpVerificationFailed();
        assertChallengeUsable(challenge, security, now);

        const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
        if (
          (await transaction.countVerificationAttemptsSince(actor.userId, since)) >=
          VERIFICATION_RATE_LIMIT
        ) {
          throw stepUpRateLimited();
        }

        const nextAttemptCount = challenge.attemptCount + 1;
        const lockedAt = nextAttemptCount >= MAXIMUM_FAILED_ATTEMPTS ? now : null;
        await transaction.incrementFailedAttempt(
          challenge.id,
          challenge.attemptCount,
          nextAttemptCount,
          lockedAt,
        );
        return { challenge, nextAttemptCount };
      });
      challengeForAudit = result.challenge;
      attemptCount = result.nextAttemptCount;
    } catch (error: unknown) {
      if (
        error instanceof StepUpStateConflictError ||
        error instanceof StepUpTransactionConflictError
      ) {
        throw stepUpVerificationFailed();
      }
      throw error;
    }

    try {
      await this.repository.recordFailureAudit({
        challenge: challengeForAudit,
        challengeId: challengeForAudit.id,
        reason: attemptCount >= MAXIMUM_FAILED_ATTEMPTS ? 'challenge_locked' : 'password_mismatch',
        attemptCount,
        context: audit,
      });
    } catch {
      reportFailureAuditProblem();
    }
  }

  private async recordDeniedVerification(
    challenge: StepUpChallengeRecord | null,
    challengeId: string,
    audit: StepUpAuditContext,
    reason: string,
    attemptCount: number,
  ): Promise<void> {
    try {
      await this.repository.recordFailureAudit({
        challenge,
        challengeId,
        reason,
        attemptCount,
        context: audit,
      });
    } catch {
      reportFailureAuditProblem();
    }
  }
}
