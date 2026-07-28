import { RoleCode, StepUpAction, StepUpContinuation, StepUpTargetType } from '@prisma/client';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PasswordService } from '../../src/modules/auth/auth.types.js';
import type { StepUpCryptoService } from '../../src/modules/step-up-authentication/step-up-crypto.service.js';
import type {
  CreateProofData,
  StepUpRepository,
  StepUpTransactionRepository,
} from '../../src/modules/step-up-authentication/step-up-authentication.repository.js';
import { StepUpAuthenticationService } from '../../src/modules/step-up-authentication/step-up-authentication.service.js';
import type {
  StepUpActor,
  StepUpChallengeRecord,
  StepUpSecurityContext,
} from '../../src/modules/step-up-authentication/step-up-authentication.types.js';
import { AppError } from '../../src/utils/app-error.js';

const now = new Date('2026-07-28T12:00:00.000Z');
const userId = '019b9e22-7f5d-7d3a-a0f1-ff64c8124a11';
const sessionId = '019b9e22-8022-796f-b12a-bb56ba452725';
const challengeId = '019b9e22-8f9c-771a-9753-67ad8f179af2';
const targetId = '019b9e22-9f9c-771a-9753-67ad8f179af3';
const continuationId = '019b9e22-af9c-771a-9753-67ad8f179af4';
const proofId = '019b9e22-bf9c-771a-9753-67ad8f179af5';
const rawProof = 'A'.repeat(43);

const actor: StepUpActor = {
  userId,
  sessionId,
  roles: [RoleCode.ADMIN],
  permissions: ['certificates.issue', 'certificates.revoke'],
};

function security(overrides: Partial<StepUpSecurityContext> = {}): StepUpSecurityContext {
  return {
    userId,
    sessionId,
    passwordHash: 'hashed:CorrectPassword1!',
    credentialEpoch: new Date('2026-07-28T10:00:00.000Z'),
    requiresPasswordChange: false,
    credentialLockedUntil: null,
    lastAuthenticatedAt: null,
    roles: [RoleCode.ADMIN],
    permissions: ['certificates.issue', 'certificates.revoke'],
    ...overrides,
  };
}

function challenge(overrides: Partial<StepUpChallengeRecord> = {}): StepUpChallengeRecord {
  return {
    id: challengeId,
    userId,
    sessionId,
    credentialEpoch: new Date('2026-07-28T10:00:00.000Z'),
    action: StepUpAction.CERTIFICATE_ISSUE,
    targetType: StepUpTargetType.ENROLLMENT,
    targetId,
    continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
    continuationId,
    attemptCount: 0,
    expiresAt: new Date('2026-07-28T12:05:00.000Z'),
    verifiedAt: null,
    lockedAt: null,
    ...overrides,
  };
}

function fakePasswordService(valid = true): PasswordService {
  return {
    hash: vi.fn(),
    verify: vi.fn().mockResolvedValue(valid),
    verifyAgainstDummyHash: vi.fn(),
  };
}

function fakeCrypto(): StepUpCryptoService {
  return {
    generateSecret: vi.fn().mockReturnValue(rawProof),
    hash: vi
      .fn()
      .mockImplementation((secret: string) =>
        createHash('sha256').update(secret, 'utf8').digest('hex'),
      ),
  };
}

function harness(
  options: {
    challenge?: StepUpChallengeRecord;
    security?: StepUpSecurityContext;
    passwordValid?: boolean;
    challengeCount?: number;
    verificationCount?: number;
    snapshotMissing?: boolean;
  } = {},
) {
  const currentChallenge = options.challenge ?? challenge();
  const currentSecurity = options.security ?? security();
  let failedAttemptCount = currentChallenge.attemptCount;
  let consumed = false;
  let proofData: CreateProofData | null = null;
  const audits: string[] = [];
  const failureAudits: Array<{ reason: string; attemptCount: number }> = [];

  const transaction = {
    getDatabaseTimestamp: vi.fn().mockResolvedValue(now),
    lockRateLimitScope: vi.fn().mockResolvedValue(undefined),
    lockSecurityState: vi.fn().mockResolvedValue(undefined),
    lockTarget: vi.fn().mockResolvedValue(undefined),
    lockChallenge: vi.fn().mockResolvedValue(undefined),
    lockProofByHash: vi.fn().mockResolvedValue(undefined),
    findSecurityContext: vi.fn().mockResolvedValue(currentSecurity),
    targetExists: vi.fn().mockResolvedValue(true),
    countChallengesSince: vi.fn().mockResolvedValue(options.challengeCount ?? 0),
    countVerificationAttemptsSince: vi.fn().mockResolvedValue(options.verificationCount ?? 0),
    findChallenge: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ...currentChallenge, attemptCount: failedAttemptCount }),
      ),
    createChallenge: vi.fn().mockResolvedValue(currentChallenge),
    incrementFailedAttempt: vi
      .fn()
      .mockImplementation(
        (_id: string, _expected: number, next: number, lockedAt: Date | null): Promise<void> => {
          failedAttemptCount = next;
          currentChallenge.attemptCount = next;
          currentChallenge.lockedAt = lockedAt;
          return Promise.resolve();
        },
      ),
    verifyChallengeAndCreateProof: vi.fn().mockImplementation((data: CreateProofData) => {
      proofData = data;
      currentChallenge.verifiedAt = data.createdAt;
      return Promise.resolve();
    }),
    findProofByHash: vi.fn().mockImplementation(() =>
      Promise.resolve({
        id: proofId,
        challengeId,
        userId,
        sessionId,
        credentialEpoch: currentSecurity.credentialEpoch,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId,
        expiresAt: new Date('2026-07-28T12:02:00.000Z'),
        consumedAt: consumed ? now : null,
        challenge: {
          verifiedAt: now,
          lockedAt: null,
          expiresAt: new Date('2026-07-28T12:05:00.000Z'),
        },
      }),
    ),
    consumeProof: vi.fn().mockImplementation(() => {
      if (consumed) throw new Error('already consumed');
      consumed = true;
      return Promise.resolve();
    }),
    createAudit: vi.fn().mockImplementation(({ action }: { action: string }) => {
      audits.push(action);
      return Promise.resolve();
    }),
  } as unknown as StepUpTransactionRepository;

  const repository: StepUpRepository = {
    withSerializableTransaction: (operation) => operation(transaction),
    findChallengeSnapshot: vi
      .fn()
      .mockResolvedValue(
        options.snapshotMissing
          ? null
          : { challenge: currentChallenge, security: currentSecurity, databaseTime: now },
      ),
    recordFailureAudit: vi.fn().mockImplementation((input) => {
      failureAudits.push({ reason: input.reason, attemptCount: input.attemptCount });
      return Promise.resolve();
    }),
  };
  const service = new StepUpAuthenticationService(
    repository,
    fakePasswordService(options.passwordValid),
    fakeCrypto(),
  );

  return {
    service,
    transaction,
    audits,
    failureAudits,
    getFailedAttemptCount: () => failedAttemptCount,
    getProofData: () => proofData,
  };
}

const createInput = {
  action: StepUpAction.CERTIFICATE_ISSUE,
  targetType: StepUpTargetType.ENROLLMENT,
  targetId,
  continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
};

describe('StepUpAuthenticationService', () => {
  it('creates an audited target-bound five-minute challenge', async () => {
    const test = harness();
    const result = await test.service.createChallenge(createInput, actor, { actorUserId: userId });

    expect(result).toMatchObject({
      id: challengeId,
      targetId,
      verificationRequired: true,
      continuationId,
    });
    expect(test.transaction.lockSecurityState).toHaveBeenCalledWith(userId, sessionId);
    expect(test.transaction.lockTarget).toHaveBeenCalledWith(
      StepUpAction.CERTIFICATE_ISSUE,
      targetId,
    );
    expect(test.audits).toEqual(['security.step_up.challenge_created']);
  });

  it('reports that password entry is unnecessary inside the recent-auth window', async () => {
    const test = harness({
      security: security({ lastAuthenticatedAt: new Date('2026-07-28T11:55:00.000Z') }),
    });
    await expect(
      test.service.createChallenge(createInput, actor, { actorUserId: userId }),
    ).resolves.toMatchObject({ verificationRequired: false });
  });

  it('does not reuse recent authentication from before the current credential epoch', async () => {
    const credentialEpoch = new Date('2026-07-28T11:58:00.000Z');
    const test = harness({
      security: security({
        credentialEpoch,
        lastAuthenticatedAt: new Date('2026-07-28T11:57:00.000Z'),
      }),
    });

    await expect(
      test.service.createChallenge(createInput, actor, { actorUserId: userId }),
    ).resolves.toMatchObject({ verificationRequired: true });

    const verification = harness({
      security: security({
        credentialEpoch,
        lastAuthenticatedAt: new Date('2026-07-28T11:57:00.000Z'),
      }),
      challenge: challenge({ credentialEpoch }),
    });
    await expect(
      verification.service.verifyChallenge(
        challengeId,
        { confirmRecentAuthentication: true },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });

  it('enforces current ADMIN role and action permission at the service boundary', async () => {
    const test = harness();
    await expect(
      test.service.createChallenge(
        createInput,
        { ...actor, permissions: [] },
        {
          actorUserId: userId,
        },
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it('enforces the distributed challenge creation limit', async () => {
    const test = harness({ challengeCount: 5 });
    await expect(
      test.service.createChallenge(createInput, actor, { actorUserId: userId }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('verifies the current password and returns a raw proof while persisting only its hash', async () => {
    const test = harness();
    const result = await test.service.verifyChallenge(
      challengeId,
      { password: 'CorrectPassword1!' },
      actor,
      { actorUserId: userId },
    );

    expect(result.proof).toBe(rawProof);
    expect(test.getProofData()).toMatchObject({
      proofHash: createHash('sha256').update(rawProof).digest('hex'),
      expiresAt: new Date('2026-07-28T12:02:00.000Z'),
    });
    expect(JSON.stringify(test.getProofData())).not.toContain(rawProof);
    expect(test.audits).toEqual(['security.step_up.succeeded']);
  });

  it('increments the failure count and records only safe failure metadata', async () => {
    const test = harness({ passwordValid: false });
    await expect(
      test.service.verifyChallenge(challengeId, { password: 'WrongPassword1!' }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });

    expect(test.getFailedAttemptCount()).toBe(1);
    expect(test.failureAudits).toEqual([{ reason: 'password_mismatch', attemptCount: 1 }]);
    expect(JSON.stringify(test.failureAudits)).not.toContain('WrongPassword1!');
  });

  it('locks the challenge on the fifth failed password verification', async () => {
    const test = harness({
      passwordValid: false,
      challenge: challenge({ attemptCount: 4 }),
    });
    await expect(
      test.service.verifyChallenge(challengeId, { password: 'Wrong' }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });
    expect(test.getFailedAttemptCount()).toBe(5);
    expect(test.failureAudits).toEqual([{ reason: 'challenge_locked', attemptCount: 5 }]);
  });

  it('rejects expired, locked, cross-session and stale-credential challenges safely', async () => {
    const expired = harness({
      challenge: challenge({ expiresAt: new Date('2026-07-28T11:59:59.000Z') }),
    });
    await expect(
      expired.service.verifyChallenge(challengeId, { password: 'CorrectPassword1!' }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_EXPIRED' });
    expect(expired.failureAudits).toEqual([{ reason: 'challenge_expired', attemptCount: 0 }]);

    const locked = harness({ challenge: challenge({ lockedAt: now, attemptCount: 5 }) });
    await expect(
      locked.service.verifyChallenge(challengeId, { password: 'CorrectPassword1!' }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });
    expect(locked.failureAudits).toEqual([{ reason: 'challenge_unavailable', attemptCount: 5 }]);

    const crossSession = harness({ snapshotMissing: true });
    await expect(
      crossSession.service.verifyChallenge(challengeId, { password: 'CorrectPassword1!' }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });
    expect(crossSession.failureAudits).toEqual([
      { reason: 'challenge_unavailable', attemptCount: 0 },
    ]);

    const stale = harness({
      security: security({ credentialEpoch: new Date('2026-07-28T11:00:00.000Z') }),
    });
    await expect(
      stale.service.verifyChallenge(challengeId, { password: 'CorrectPassword1!' }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
    expect(stale.failureAudits).toEqual([{ reason: 'security_state_changed', attemptCount: 0 }]);
  });

  it('allows recent-auth confirmation only while the session remains recent', async () => {
    const recent = harness({
      security: security({ lastAuthenticatedAt: new Date('2026-07-28T11:55:00.000Z') }),
    });
    await expect(
      recent.service.verifyChallenge(challengeId, { confirmRecentAuthentication: true }, actor, {
        actorUserId: userId,
      }),
    ).resolves.toMatchObject({ proof: rawProof });

    const old = harness({
      security: security({ lastAuthenticatedAt: new Date('2026-07-28T11:49:59.000Z') }),
    });
    await expect(
      old.service.verifyChallenge(challengeId, { confirmRecentAuthentication: true }, actor, {
        actorUserId: userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
    expect(old.failureAudits).toEqual([
      { reason: 'recent_authentication_required', attemptCount: 0 },
    ]);
  });

  it('consumes a correctly bound proof once and audits in the caller transaction', async () => {
    const test = harness();
    const input = {
      proof: rawProof,
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
    };
    await expect(
      test.service.consumeProof(test.transaction, input, actor, { actorUserId: userId }),
    ).resolves.toMatchObject({ proofId, challengeId, consumedAt: now });
    expect(test.audits).toEqual(['security.step_up.proof_consumed']);

    await expect(
      test.service.consumeProof(test.transaction, input, actor, { actorUserId: userId }),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
  });

  it('maps a malformed raw proof to the stable proof-invalid domain error', async () => {
    const test = harness();

    await expect(
      test.service.consumeProof(
        test.transaction,
        {
          proof: 'not-a-valid-proof',
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId,
        },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
    expect(test.transaction.findProofByHash).not.toHaveBeenCalled();
  });

  it('rejects cross-action, cross-target and stale-credential proof reuse', async () => {
    const test = harness();
    await expect(
      test.service.consumeProof(
        test.transaction,
        {
          proof: rawProof,
          action: StepUpAction.CERTIFICATE_REVOKE,
          targetType: StepUpTargetType.CERTIFICATE,
          targetId,
        },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      test.service.consumeProof(
        test.transaction,
        {
          proof: rawProof,
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId: '019b9e22-cf9c-771a-9753-67ad8f179af6',
        },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });

    const stale = harness({
      security: security({ credentialEpoch: new Date('2026-07-28T11:00:00.000Z') }),
    });
    const staleProof = stale.transaction.findProofByHash as ReturnType<typeof vi.fn>;
    staleProof.mockResolvedValueOnce({
      id: proofId,
      challengeId,
      userId,
      sessionId,
      credentialEpoch: new Date('2026-07-28T10:00:00.000Z'),
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
      expiresAt: new Date('2026-07-28T12:02:00.000Z'),
      consumedAt: null,
      challenge: { verifiedAt: now, lockedAt: null, expiresAt: new Date('2026-07-28T12:05:00Z') },
    });
    await expect(
      stale.service.consumeProof(
        stale.transaction,
        {
          proof: rawProof,
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId,
        },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
  });

  it('rejects expired and cross-session proof consumption', async () => {
    const expired = harness();
    const expiredProofLookup = expired.transaction.findProofByHash as ReturnType<typeof vi.fn>;
    expiredProofLookup.mockResolvedValueOnce({
      id: proofId,
      challengeId,
      userId,
      sessionId,
      credentialEpoch: new Date('2026-07-28T10:00:00.000Z'),
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
      expiresAt: new Date('2026-07-28T11:59:59.000Z'),
      consumedAt: null,
      challenge: {
        verifiedAt: new Date('2026-07-28T11:58:00.000Z'),
        lockedAt: null,
        expiresAt: new Date('2026-07-28T12:05:00.000Z'),
      },
    });
    await expect(
      expired.service.consumeProof(
        expired.transaction,
        {
          proof: rawProof,
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId,
        },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_EXPIRED' });

    const otherSession = harness();
    const otherSessionLookup = otherSession.transaction.findProofByHash as ReturnType<typeof vi.fn>;
    otherSessionLookup.mockResolvedValueOnce({
      id: proofId,
      challengeId,
      userId,
      sessionId: '019b9e22-df9c-771a-9753-67ad8f179af7',
      credentialEpoch: new Date('2026-07-28T10:00:00.000Z'),
      action: StepUpAction.CERTIFICATE_ISSUE,
      targetType: StepUpTargetType.ENROLLMENT,
      targetId,
      expiresAt: new Date('2026-07-28T12:02:00.000Z'),
      consumedAt: null,
      challenge: {
        verifiedAt: now,
        lockedAt: null,
        expiresAt: new Date('2026-07-28T12:05:00.000Z'),
      },
    });
    await expect(
      otherSession.service.consumeProof(
        otherSession.transaction,
        {
          proof: rawProof,
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId,
        },
        actor,
        { actorUserId: userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
  });
});
