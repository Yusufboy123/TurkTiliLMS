import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CourseEnrollmentSource,
  CourseStatus,
  PrismaClient,
  RoleCode,
  SessionClientType,
  StepUpAction,
  StepUpContinuation,
  StepUpTargetType,
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LoginCredentialConflictError,
  PrismaAuthRepository,
} from '../../src/modules/auth/auth.repository.js';
import { BcryptPasswordService } from '../../src/modules/auth/password.service.js';
import { NodeStepUpCryptoService } from '../../src/modules/step-up-authentication/step-up-crypto.service.js';
import { PrismaStepUpRepository } from '../../src/modules/step-up-authentication/step-up-authentication.repository.js';
import { StepUpAuthenticationService } from '../../src/modules/step-up-authentication/step-up-authentication.service.js';
import type {
  StepUpActor,
  StepUpAuditContext,
} from '../../src/modules/step-up-authentication/step-up-authentication.types.js';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');
const schemaName = `step_up_runtime_test_${randomUUID().replaceAll('-', '')}`;
const password = 'StepUpIntegrationPassword1!';

describeDatabase('Module 8.6C step-up runtime on PostgreSQL', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  let client: PrismaClient;
  let repository: PrismaStepUpRepository;
  let service: StepUpAuthenticationService;
  let actor: StepUpActor;
  let audit: StepUpAuditContext;
  let enrollmentId = '';
  let passwordHash = '';

  async function createAdminContext(label: string): Promise<{
    actor: StepUpActor;
    enrollmentId: string;
  }> {
    const admin = await client.user.create({
      data: {
        email: `step-up-admin-${label}-${randomUUID()}@example.com`,
        credential: { create: { passwordHash } },
        roles: {
          create: {
            role: { connect: { code: RoleCode.ADMIN } },
          },
        },
      },
    });
    const session = await client.userSession.create({
      data: {
        userId: admin.id,
        refreshTokenHash: new NodeStepUpCryptoService().hash(randomUUID()),
        tokenFamilyId: randomUUID(),
        clientType: SessionClientType.WEB,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const student = await client.user.create({
      data: { email: `step-up-student-${label}-${randomUUID()}@example.com` },
    });
    const course = await client.course.create({
      data: {
        title: `Step-up course ${label}`,
        slug: `step-up-course-${label}-${randomUUID()}`,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: admin.id,
      },
    });
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId: course.id,
        studentId: student.id,
        source: CourseEnrollmentSource.SELF,
      },
    });
    return {
      actor: {
        userId: admin.id,
        sessionId: session.id,
        roles: [RoleCode.ADMIN],
        permissions: ['certificates.issue', 'certificates.revoke'],
      },
      enrollmentId: enrollment.id,
    };
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^step_up_runtime_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated test schema name is invalid.');
    }
    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    const isolatedDatabaseUrl = url.toString();
    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${schemaName}"."citext" AS public.citext`,
    );
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
      windowsHide: true,
    });
    client = new PrismaClient({ datasourceUrl: isolatedDatabaseUrl });

    const adminRole = await client.role.create({
      data: { code: RoleCode.ADMIN, name: 'Administrator' },
    });
    for (const permissionCode of ['certificates.issue', 'certificates.revoke']) {
      const [resource, action] = permissionCode.split('.');
      const permission = await client.permission.create({
        data: {
          code: permissionCode,
          resource: resource!,
          action: action!,
        },
      });
      await client.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: permission.id },
      });
    }

    passwordHash = await new BcryptPasswordService(10).hash(password);
    const context = await createAdminContext('primary');
    actor = context.actor;
    enrollmentId = context.enrollmentId;
    audit = {
      actorUserId: actor.userId,
      ipHash: 'a'.repeat(64),
      userAgentSummary: 'integration-test',
    };
    repository = new PrismaStepUpRepository(client);
    service = new StepUpAuthenticationService(
      repository,
      new BcryptPasswordService(10),
      new NodeStepUpCryptoService(),
    );
  }, 90_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (testDatabaseUrl && /^step_up_runtime_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    await administrationClient.$disconnect();
  });

  it('creates, verifies and persists only the proof hash with recent-auth and audits', async () => {
    const challenge = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      actor,
      audit,
    );
    expect(challenge.verificationRequired).toBe(true);

    const result = await service.verifyChallenge(challenge.id, { password }, actor, audit);
    expect(result.proof).toMatch(/^[A-Za-z0-9_-]{43}$/u);

    const [storedProof, session, audits] = await Promise.all([
      client.stepUpProof.findUniqueOrThrow({ where: { challengeId: challenge.id } }),
      client.userSession.findUniqueOrThrow({ where: { id: actor.sessionId } }),
      client.auditLog.findMany({
        where: {
          actorUserId: actor.userId,
          action: {
            in: ['security.step_up.challenge_created', 'security.step_up.succeeded'],
          },
        },
      }),
    ]);
    const expectedHash = new NodeStepUpCryptoService().hash(result.proof);
    expect(storedProof.proofHash).toBe(expectedHash);
    expect(JSON.stringify(storedProof)).not.toContain(result.proof);
    expect(session.lastAuthenticatedAt).not.toBeNull();
    expect(audits.map(({ action }) => action).sort()).toEqual([
      'security.step_up.challenge_created',
      'security.step_up.succeeded',
    ]);
    expect(JSON.stringify(audits)).not.toContain(password);
    expect(JSON.stringify(audits)).not.toContain(result.proof);
  });

  it('records password login as recent authentication on the newly created session', async () => {
    const user = await client.user.create({
      data: {
        email: `step-up-login-${randomUUID()}@example.com`,
        credential: { create: { passwordHash } },
      },
    });
    const credential = await client.userCredential.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const sessionId = await new PrismaAuthRepository(client).completeLogin({
      userId: user.id,
      expectedPasswordHash: credential.passwordHash,
      expectedCredentialEpoch: credential.passwordChangedAt,
      refreshTokenHash: new NodeStepUpCryptoService().hash(randomUUID()),
      tokenFamilyId: randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000),
      metadata: { clientType: SessionClientType.WEB },
    });
    await expect(
      client.userSession.findUniqueOrThrow({ where: { id: sessionId } }),
    ).resolves.toEqual(expect.objectContaining({ lastAuthenticatedAt: expect.any(Date) }));
  });

  it('does not create a login session when the credential epoch changes after password verification', async () => {
    const user = await client.user.create({
      data: {
        email: `step-up-stale-login-${randomUUID()}@example.com`,
        credential: { create: { passwordHash } },
      },
    });
    const credential = await client.userCredential.findUniqueOrThrow({
      where: { userId: user.id },
    });
    await client.userCredential.update({
      where: { userId: user.id },
      data: { passwordChangedAt: new Date(credential.passwordChangedAt.getTime() + 1) },
    });

    await expect(
      new PrismaAuthRepository(client).completeLogin({
        userId: user.id,
        expectedPasswordHash: credential.passwordHash,
        expectedCredentialEpoch: credential.passwordChangedAt,
        refreshTokenHash: new NodeStepUpCryptoService().hash(randomUUID()),
        tokenFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
        metadata: { clientType: SessionClientType.WEB },
      }),
    ).rejects.toBeInstanceOf(LoginCredentialConflictError);
    await expect(client.userSession.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('increments failures monotonically, locks at five and creates no proof', async () => {
    const context = await createAdminContext('failures');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const created = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      localAudit,
    );

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        service.verifyChallenge(
          created.id,
          { password: `wrong-password-${attempt}` },
          context.actor,
          localAudit,
        ),
      ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });
    }
    const stored = await client.stepUpChallenge.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.attemptCount).toBe(5);
    expect(stored.lockedAt).not.toBeNull();
    await expect(client.stepUpProof.count({ where: { challengeId: created.id } })).resolves.toBe(0);
    await expect(
      client.userSession.findUniqueOrThrow({ where: { id: context.actor.sessionId } }),
    ).resolves.toMatchObject({ lastAuthenticatedAt: null });
    await expect(
      service.verifyChallenge(created.id, { password }, context.actor, localAudit),
    ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });
  });

  it('serializes concurrent failed attempts and cannot increment beyond the lock threshold', async () => {
    const context = await createAdminContext('concurrent-failures');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const created = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      localAudit,
    );

    const outcomes = await Promise.allSettled(
      Array.from({ length: 6 }, (_, attempt) =>
        service.verifyChallenge(
          created.id,
          { password: `concurrent-wrong-password-${attempt}` },
          context.actor,
          localAudit,
        ),
      ),
    );

    expect(outcomes.every(({ status }) => status === 'rejected')).toBe(true);
    await expect(
      client.stepUpChallenge.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ attemptCount: 5, lockedAt: expect.any(Date) });
    await expect(client.stepUpProof.count({ where: { challengeId: created.id } })).resolves.toBe(0);
    await expect(
      client.auditLog.count({
        where: {
          actorUserId: context.actor.userId,
          action: 'security.step_up.failed',
          subjectId: created.id,
        },
      }),
    ).resolves.toBe(6);
  });

  it('allows exactly one concurrent proof creation for a challenge', async () => {
    const context = await createAdminContext('concurrent-verification');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const created = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      localAudit,
    );

    const outcomes = await Promise.allSettled([
      service.verifyChallenge(created.id, { password }, context.actor, localAudit),
      service.verifyChallenge(created.id, { password }, context.actor, localAudit),
    ]);

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    await expect(client.stepUpProof.count({ where: { challengeId: created.id } })).resolves.toBe(1);
    await expect(
      client.auditLog.count({
        where: {
          actorUserId: context.actor.userId,
          action: 'security.step_up.succeeded',
          subjectId: created.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it('rejects cross-session and stale credential bindings without enumeration', async () => {
    const context = await createAdminContext('binding');
    const created = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      { ...audit, actorUserId: context.actor.userId },
    );
    const otherSession = await client.userSession.create({
      data: {
        userId: context.actor.userId,
        refreshTokenHash: new NodeStepUpCryptoService().hash(randomUUID()),
        tokenFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await expect(
      service.verifyChallenge(
        created.id,
        { password },
        { ...context.actor, sessionId: otherSession.id },
        { ...audit, actorUserId: context.actor.userId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_VERIFICATION_FAILED' });

    await client.userCredential.update({
      where: { userId: context.actor.userId },
      data: { passwordChangedAt: new Date() },
    });
    await expect(
      service.verifyChallenge(created.id, { password }, context.actor, {
        ...audit,
        actorUserId: context.actor.userId,
      }),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
  });

  it('invalidates recent authentication that predates the current credential epoch', async () => {
    const context = await createAdminContext('recent-auth-epoch');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const databaseClock = await client.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `;
    const databaseTime = databaseClock[0]?.now;
    if (!databaseTime) throw new Error('Database timestamp could not be read.');
    await client.userSession.update({
      where: { id: context.actor.sessionId },
      data: { lastAuthenticatedAt: new Date(databaseTime!.getTime() - 60_000) },
    });
    await client.userCredential.update({
      where: { userId: context.actor.userId },
      data: { passwordChangedAt: databaseTime },
    });

    const challenge = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      localAudit,
    );

    expect(challenge.verificationRequired).toBe(true);
    await expect(
      service.verifyChallenge(
        challenge.id,
        { confirmRecentAuthentication: true },
        context.actor,
        localAudit,
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
    await expect(client.stepUpProof.count({ where: { challengeId: challenge.id } })).resolves.toBe(
      0,
    );
    await expect(
      client.auditLog.findFirstOrThrow({
        where: {
          actorUserId: context.actor.userId,
          action: 'security.step_up.failed',
          subjectId: challenge.id,
        },
      }),
    ).resolves.toMatchObject({
      metadata: expect.objectContaining({ reason: 'recent_authentication_required' }),
    });
  });

  it('uses the database clock to reject an expired challenge', async () => {
    const context = await createAdminContext('database-expiry');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const databaseClock = await client.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `;
    const databaseTime = databaseClock[0]?.now;
    if (!databaseTime) throw new Error('Database timestamp could not be read.');
    const credentialEpoch = new Date(databaseTime!.getTime() - 6 * 60_000);
    await client.userCredential.update({
      where: { userId: context.actor.userId },
      data: { passwordChangedAt: credentialEpoch },
    });
    const createdAt = new Date(databaseTime!.getTime() - 5 * 60_000);
    const expiresAt = new Date(databaseTime!.getTime() - 1);
    const challenge = await client.stepUpChallenge.create({
      data: {
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
        nonceHash: new NodeStepUpCryptoService().hash(randomUUID()),
        credentialEpoch,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
        continuationId: randomUUID(),
        createdAt,
        expiresAt,
      },
    });

    await expect(
      service.verifyChallenge(challenge.id, { password }, context.actor, localAudit),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_EXPIRED' });
    await expect(client.stepUpProof.count({ where: { challengeId: challenge.id } })).resolves.toBe(
      0,
    );
    await expect(
      client.auditLog.findFirstOrThrow({
        where: {
          actorUserId: context.actor.userId,
          action: 'security.step_up.failed',
          subjectId: challenge.id,
        },
      }),
    ).resolves.toMatchObject({
      metadata: expect.objectContaining({ reason: 'challenge_expired' }),
    });
  });

  it('allows exactly one concurrent proof consumer and rolls audit into that transaction', async () => {
    const context = await createAdminContext('consume');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const challenge = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      localAudit,
    );
    const proof = await service.verifyChallenge(
      challenge.id,
      { password },
      context.actor,
      localAudit,
    );
    const consume = () =>
      repository.withSerializableTransaction((transaction) =>
        service.consumeProof(
          transaction,
          {
            proof: proof.proof,
            action: StepUpAction.CERTIFICATE_ISSUE,
            targetType: StepUpTargetType.ENROLLMENT,
            targetId: context.enrollmentId,
          },
          context.actor,
          localAudit,
        ),
      );

    const outcomes = await Promise.allSettled([consume(), consume()]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    await expect(
      client.auditLog.count({
        where: {
          actorUserId: context.actor.userId,
          action: 'security.step_up.proof_consumed',
        },
      }),
    ).resolves.toBe(1);
    await expect(
      client.stepUpProof.findUniqueOrThrow({ where: { challengeId: challenge.id } }),
    ).resolves.toMatchObject({ consumedAt: expect.any(Date) });
  });

  it('rejects proof consumption after the bound session is revoked', async () => {
    const context = await createAdminContext('revoked-session');
    const localAudit = { ...audit, actorUserId: context.actor.userId };
    const challenge = await service.createChallenge(
      {
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
      },
      context.actor,
      localAudit,
    );
    const proof = await service.verifyChallenge(
      challenge.id,
      { password },
      context.actor,
      localAudit,
    );
    await client.userSession.update({
      where: { id: context.actor.sessionId },
      data: { revokedAt: new Date(), revocationReason: 'integration_test' },
    });

    await expect(
      repository.withSerializableTransaction((transaction) =>
        service.consumeProof(
          transaction,
          {
            proof: proof.proof,
            action: StepUpAction.CERTIFICATE_ISSUE,
            targetType: StepUpTargetType.ENROLLMENT,
            targetId: context.enrollmentId,
          },
          context.actor,
          localAudit,
        ),
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
    await expect(
      client.stepUpProof.findUniqueOrThrow({ where: { challengeId: challenge.id } }),
    ).resolves.toMatchObject({ consumedAt: null });
  });
});
