import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  CertificateLifecycleStatus,
  CertificateRevocationReasonCode,
  CertificateTemplateVersionStatus,
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseStatus,
  PrismaClient,
  ProgressEventState,
  ProgressEventType,
  RoleCode,
  SessionClientType,
  StepUpAction,
  StepUpContinuation,
  StepUpTargetType,
} from '@prisma/client';
import type { PasswordService } from '../../src/modules/auth/auth.types.js';
import {
  CERTIFICATE_RENDERER_CONTRACT_VERSION,
  CERTIFICATE_TEMPLATE_CODE,
  CERTIFICATE_TEMPLATE_VERSION,
} from '../../src/modules/certificate-artifacts/certificate-artifact.constants.js';
import { PackageNotoSansFontSource } from '../../src/modules/certificate-artifacts/certificate-font-source.js';
import { PrismaCertificateArtifactRepository } from '../../src/modules/certificate-artifacts/certificate-artifact.repository.js';
import { PdfKitCertificateRenderer } from '../../src/modules/certificate-artifacts/certificate-artifact.renderer.js';
import { CertificateArtifactService } from '../../src/modules/certificate-artifacts/certificate-artifact.service.js';
import { LocalCertificateArtifactStorage } from '../../src/modules/certificate-artifacts/certificate-artifact.storage.js';
import { PrismaCertificateIssuanceRepository } from '../../src/modules/certificate-issuance/certificate-issuance.repository.js';
import { CertificateIssuanceService } from '../../src/modules/certificate-issuance/certificate-issuance.service.js';
import type { CertificateActor } from '../../src/modules/certificate-issuance/certificate-issuance.types.js';
import { NodeStepUpCryptoService } from '../../src/modules/step-up-authentication/step-up-crypto.service.js';
import { PrismaStepUpRepository } from '../../src/modules/step-up-authentication/step-up-authentication.repository.js';
import { StepUpAuthenticationService } from '../../src/modules/step-up-authentication/step-up-authentication.service.js';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');

function suffix(): string {
  return randomUUID().replaceAll('-', '');
}

describeDatabase('Module 8.6E certificate issuance PostgreSQL integration', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `certificate_issuance_test_${suffix()}`;
  let client: PrismaClient;
  let service: CertificateIssuanceService;
  let issuanceRepository: PrismaCertificateIssuanceRepository;
  let artifactService: CertificateArtifactService;
  let stepUpService: StepUpAuthenticationService;
  let storageRoot = '';
  let adminId = '';
  let sessionId = '';
  let courseId = '';
  let policyId = '';
  let templateVersionId = '';

  const passwordService: PasswordService = {
    hash: vi.fn(),
    verify: vi.fn(),
    verifyAgainstDummyHash: vi.fn(),
  };

  function adminActor(): CertificateActor {
    return {
      userId: adminId,
      sessionId,
      roles: [RoleCode.ADMIN],
      permissions: [
        'certificates.issue',
        'certificates.revoke',
        'certificates.course_read',
        'certificates.download',
      ],
    };
  }

  async function deployMigrations(databaseUrl: string): Promise<void> {
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      windowsHide: true,
    });
  }

  async function createProof(enrollmentId: string): Promise<string> {
    const crypto = new NodeStepUpCryptoService();
    const rawProof = randomBytes(32).toString('base64url');
    const credential = await client.userCredential.findUniqueOrThrow({
      where: { userId: adminId },
    });
    const createdAt = new Date(Date.now() - 1_000);
    const verifiedAt = new Date();
    const challenge = await client.stepUpChallenge.create({
      data: {
        userId: adminId,
        sessionId,
        nonceHash: crypto.hash(randomBytes(32).toString('base64url')),
        credentialEpoch: credential.passwordChangedAt,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
        continuationId: randomUUID(),
        expiresAt: new Date(createdAt.getTime() + 5 * 60_000),
        verifiedAt,
        createdAt,
      },
    });
    await client.stepUpProof.create({
      data: {
        challengeId: challenge.id,
        userId: adminId,
        sessionId,
        proofHash: crypto.hash(rawProof),
        credentialEpoch: credential.passwordChangedAt,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: enrollmentId,
        expiresAt: new Date(verifiedAt.getTime() + 2 * 60_000),
        createdAt: verifiedAt,
      },
    });
    return rawProof;
  }

  async function createRevocationProof(certificateId: string): Promise<string> {
    const crypto = new NodeStepUpCryptoService();
    const rawProof = randomBytes(32).toString('base64url');
    const credential = await client.userCredential.findUniqueOrThrow({
      where: { userId: adminId },
    });
    const createdAt = new Date(Date.now() - 1_000);
    const verifiedAt = new Date();
    const challenge = await client.stepUpChallenge.create({
      data: {
        userId: adminId,
        sessionId,
        nonceHash: crypto.hash(randomBytes(32).toString('base64url')),
        credentialEpoch: credential.passwordChangedAt,
        action: StepUpAction.CERTIFICATE_REVOKE,
        targetType: StepUpTargetType.CERTIFICATE,
        targetId: certificateId,
        continuation: StepUpContinuation.CERTIFICATE_REVOKE_CONFIRMATION,
        continuationId: randomUUID(),
        expiresAt: new Date(createdAt.getTime() + 5 * 60_000),
        verifiedAt,
        createdAt,
      },
    });
    await client.stepUpProof.create({
      data: {
        challengeId: challenge.id,
        userId: adminId,
        sessionId,
        proofHash: crypto.hash(rawProof),
        credentialEpoch: credential.passwordChangedAt,
        action: StepUpAction.CERTIFICATE_REVOKE,
        targetType: StepUpTargetType.CERTIFICATE,
        targetId: certificateId,
        expiresAt: new Date(verifiedAt.getTime() + 2 * 60_000),
        createdAt: verifiedAt,
      },
    });
    return rawProof;
  }

  async function createEligibleEnrollment(label: string) {
    const student = await client.user.create({
      data: {
        email: `issue-student-${label}-${randomUUID()}@example.com`,
        displayName: `O\u2018quvchi ${label}`,
      },
    });
    const completedAt = new Date('2026-07-29T07:00:00.000Z');
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId,
        studentId: student.id,
        source: CourseEnrollmentSource.ADMIN,
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt,
        createdById: adminId,
      },
    });
    await client.enrollmentProgressRoot.create({
      data: {
        enrollmentId: enrollment.id,
        curriculumVersion: 1,
        completionVersion: 1,
        completedEligibleBlocks: 1,
        totalEligibleBlocks: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        frozenAt: completedAt,
      },
    });
    await client.progressEvent.create({
      data: {
        enrollmentId: enrollment.id,
        actorUserId: student.id,
        eventType: ProgressEventType.COURSE_COMPLETED,
        previousState: ProgressEventState.IN_PROGRESS,
        newState: ProgressEventState.COMPLETED,
        curriculumVersion: 1,
        resultingCompletionVersion: 1,
        snapshotCompletedEligibleBlocks: 1,
        snapshotTotalEligibleBlocks: 1,
        snapshotCompletedLessons: 1,
        snapshotTotalEligibleLessons: 1,
        snapshotCoursePercentage: 100,
        occurredAt: completedAt,
      },
    });
    const evaluation = await client.certificateEligibilityEvaluation.create({
      data: {
        enrollmentId: enrollment.id,
        courseId,
        policyId,
        status: CertificateEligibilityStatus.ELIGIBLE,
        evaluationVersion: 1,
        evaluatedAt: completedAt,
        completedAt,
        completionCurriculumVersion: 1,
        completionVersion: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
      },
    });
    const proof = await createProof(enrollment.id);
    return {
      student,
      enrollment,
      evaluation,
      proof,
      command: {
        enrollmentId: enrollment.id,
        idempotencyKey: `issue-${label}-${randomUUID()}`,
        stepUpProof: proof,
        input: {
          eligibilityEvaluationId: evaluation.id,
          eligibilityEvaluationVersion: 1,
          completionVersion: 1,
          curriculumVersion: 1,
          confirmed: true as const,
        },
      },
    };
  }

  async function createDirectCertificate(label: string) {
    const fixture = await createEligibleEnrollment(`direct-${label}`);
    const verificationIdentifier = randomBytes(32).toString('base64url');
    const issuedAt = new Date();
    const certificate = await client.certificate.create({
      data: {
        verificationTokenHash: createHash('sha256').update(verificationIdentifier).digest('hex'),
        enrollmentId: fixture.enrollment.id,
        courseId,
        eligibilityEvaluationId: fixture.evaluation.id,
        templateVersionId,
        recipientDisplayName: fixture.student.displayName ?? 'O\u2018quvchi',
        courseTitle: `O\u2018zgarmas kurs ${label}`,
        organizationName: 'Turk Tili LMS',
        locale: 'uz-Latn',
        issueDate: new Date(
          Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth(), issuedAt.getUTCDate()),
        ),
        issuedAt,
        issuedByUserId: adminId,
        artifact: {
          create: {
            storageKey: `certificates/integration/${randomUUID()}.pdf`,
            sizeBytes: 128n,
            checksum: createHash('sha256').update(`artifact-${label}`).digest('hex'),
            rendererIdentifier: 'integration-renderer',
            rendererVersion: '1',
            finalizedAt: issuedAt,
          },
        },
      },
      include: { artifact: true },
    });
    return { ...fixture, certificate, verificationIdentifier };
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^certificate_issuance_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated database schema name is invalid.');
    }
    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    const isolatedDatabaseUrl = url.toString();
    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${schemaName}"."citext" AS public.citext`,
    );
    await deployMigrations(isolatedDatabaseUrl);
    client = new PrismaClient({ datasourceUrl: isolatedDatabaseUrl });

    const adminRole = await client.role.create({
      data: { code: RoleCode.ADMIN, name: 'Admin' },
    });
    const [issuePermission, revokePermission] = await Promise.all([
      client.permission.create({
        data: {
          code: 'certificates.issue',
          resource: 'certificates',
          action: 'issue',
        },
      }),
      client.permission.create({
        data: {
          code: 'certificates.revoke',
          resource: 'certificates',
          action: 'revoke',
        },
      }),
    ]);
    const credentialEpoch = new Date(Date.now() - 60_000);
    const admin = await client.user.create({
      data: {
        email: `issue-admin-${randomUUID()}@example.com`,
        displayName: 'Admin',
        credential: {
          create: {
            passwordHash: 'not-used-by-consumption',
            passwordChangedAt: credentialEpoch,
          },
        },
      },
    });
    adminId = admin.id;
    await client.userRole.create({ data: { userId: adminId, roleId: adminRole.id } });
    await client.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: issuePermission.id },
        { roleId: adminRole.id, permissionId: revokePermission.id },
      ],
    });
    const session = await client.userSession.create({
      data: {
        userId: adminId,
        refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        tokenFamilyId: randomUUID(),
        clientType: SessionClientType.WEB,
        lastAuthenticatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    sessionId = session.id;
    const course = await client.course.create({
      data: {
        title: 'Turk tili A1',
        slug: `certificate-issuance-${randomUUID()}`,
        status: CourseStatus.ARCHIVED,
        archivedAt: new Date(),
        createdByUserId: adminId,
      },
    });
    courseId = course.id;
    const policy = await client.certificateEligibilityPolicy.create({
      data: {
        code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
        version: 1,
        assessmentRule: CertificateEligibilityAssessmentRule.NONE,
      },
    });
    policyId = policy.id;

    storageRoot = await mkdtemp(join(tmpdir(), 'turk-tili-issuance-storage-'));
    const renderer = new PdfKitCertificateRenderer(
      new PackageNotoSansFontSource(),
      10_000,
      10_485_760,
    );
    const font = await renderer.fontManifest();
    const template = await client.certificateTemplate.create({
      data: { code: CERTIFICATE_TEMPLATE_CODE, name: 'Standard Course Completion' },
    });
    const activatedAt = new Date();
    const templateVersion = await client.certificateTemplateVersion.create({
      data: {
        templateId: template.id,
        version: CERTIFICATE_TEMPLATE_VERSION,
        locale: 'uz-Latn',
        status: CertificateTemplateVersionStatus.ACTIVE,
        rendererContractVersion: CERTIFICATE_RENDERER_CONTRACT_VERSION,
        organizationDisplayName: 'Turk Tili LMS',
        organizationLegalName: 'Turk Tili LMS',
        signatoryName: 'Platform rahbari',
        signatoryTitle: 'Direktor',
        fontAssetId: font.assetId,
        fontAssetChecksum: font.checksum,
        fontFamily: font.family,
        fontVersion: font.version,
        fontLicenseIdentifier: font.licenseIdentifier,
        fontLicenseProvenance: font.licenseProvenance,
        activatedAt,
        createdAt: new Date(activatedAt.getTime() - 1),
      },
    });
    templateVersionId = templateVersion.id;
    const storage = new LocalCertificateArtifactStorage(storageRoot, 10_485_760);
    artifactService = new CertificateArtifactService(
      new PrismaCertificateArtifactRepository(client),
      renderer,
      storage,
      10_485_760,
    );
    stepUpService = new StepUpAuthenticationService(
      new PrismaStepUpRepository(client),
      passwordService,
      new NodeStepUpCryptoService(),
    );
    issuanceRepository = new PrismaCertificateIssuanceRepository(client);
    service = new CertificateIssuanceService(issuanceRepository, artifactService, stepUpService);
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    await rm(storageRoot, { recursive: true, force: true });
    if (/^certificate_issuance_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    await administrationClient.$disconnect();
  });

  it('commits certificate, artifact, proof, issue audit, and idempotency receipt atomically', async () => {
    const fixture = await createEligibleEnrollment('atomic');
    const response = await service.issueCertificate(fixture.command, adminActor(), {
      actorUserId: adminId,
    });
    const [certificate, proof, audits, idempotency] = await Promise.all([
      client.certificate.findUniqueOrThrow({
        where: { enrollmentId: fixture.enrollment.id },
        include: { artifact: true },
      }),
      client.stepUpProof.findFirstOrThrow({
        where: { targetId: fixture.enrollment.id },
      }),
      client.auditLog.findMany({
        where: {
          actorUserId: adminId,
          action: {
            in: [
              'certificate.issue_requested',
              'security.step_up.proof_consumed',
              'certificate.issued',
            ],
          },
        },
      }),
      client.idempotencyRecord.findUniqueOrThrow({
        where: {
          actorUserId_key: {
            actorUserId: adminId,
            key: fixture.command.idempotencyKey,
          },
        },
      }),
    ]);

    expect(certificate).toMatchObject({
      id: response.response.data.certificateId,
      status: CertificateLifecycleStatus.ISSUED,
      version: 1,
      artifact: expect.objectContaining({ mimeType: 'application/pdf' }),
    });
    expect(certificate.certificateNumber).toMatch(/^TTL-\d{4}-\d{10}$/u);
    expect(proof.consumedAt).toBeInstanceOf(Date);
    expect(audits.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'certificate.issue_requested',
        'security.step_up.proof_consumed',
        'certificate.issued',
      ]),
    );
    expect(idempotency).toMatchObject({
      responseStatus: 201,
      resultingCertificateId: certificate.id,
      resultingCertificateVersion: 1,
    });
    expect(certificate.verificationTokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(response)).not.toContain(certificate.verificationTokenHash);
    const requestedAudit = audits.find(({ action }) => action === 'certificate.issue_requested');
    expect(requestedAudit?.metadata).toMatchObject({ templateVersion: 1 });
  }, 30_000);

  it('replays the exact receipt without a new proof, certificate, artifact, or audit', async () => {
    const fixture = await createEligibleEnrollment('replay');
    const first = await service.issueCertificate(fixture.command, adminActor(), {
      actorUserId: adminId,
    });
    const issuedAuditCount = await client.auditLog.count({
      where: {
        action: 'certificate.issued',
        subjectId: first.response.data.certificateId,
      },
    });
    const second = await service.issueCertificate(
      { ...fixture.command, stepUpProof: 'Z'.repeat(43) },
      adminActor(),
      { actorUserId: adminId },
    );
    expect(second).toEqual(first);
    await expect(
      client.certificate.count({ where: { enrollmentId: fixture.enrollment.id } }),
    ).resolves.toBe(1);
    await expect(
      client.certificateArtifact.count({
        where: { certificateId: first.response.data.certificateId },
      }),
    ).resolves.toBe(1);
    await expect(
      client.auditLog.count({
        where: {
          action: 'certificate.issued',
          subjectId: first.response.data.certificateId,
        },
      }),
    ).resolves.toBe(issuedAuditCount);
  }, 30_000);

  it('rejects duplicate issuance under a new key and retains one immutable certificate', async () => {
    const fixture = await createEligibleEnrollment('duplicate');
    await service.issueCertificate(fixture.command, adminActor(), { actorUserId: adminId });
    const secondProof = await createProof(fixture.enrollment.id);
    await expect(
      service.issueCertificate(
        {
          ...fixture.command,
          idempotencyKey: `new-${randomUUID()}`,
          stepUpProof: secondProof,
        },
        adminActor(),
        { actorUserId: adminId },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ALREADY_ISSUED' });
    await expect(
      client.certificate.count({ where: { enrollmentId: fixture.enrollment.id } }),
    ).resolves.toBe(1);
  }, 30_000);

  it('rejects an invalid target-bound proof without certificate or artifact persistence', async () => {
    const fixture = await createEligibleEnrollment('invalid-proof');
    const artifactCountBefore = await client.certificateArtifact.count();
    await expect(
      service.issueCertificate(
        { ...fixture.command, stepUpProof: randomBytes(32).toString('base64url') },
        adminActor(),
        { actorUserId: adminId },
      ),
    ).rejects.toMatchObject({ code: 'STEP_UP_PROOF_INVALID' });
    await expect(
      client.certificate.count({ where: { enrollmentId: fixture.enrollment.id } }),
    ).resolves.toBe(0);
    await expect(client.certificateArtifact.count()).resolves.toBe(artifactCountBefore);
  }, 30_000);

  it('rolls proof consumption back when the owning serializable transaction fails', async () => {
    const fixture = await createEligibleEnrollment('rollback');
    const proofBefore = await client.stepUpProof.findFirstOrThrow({
      where: { targetId: fixture.enrollment.id },
    });

    await expect(
      issuanceRepository.withSerializableTransaction(async (transaction) => {
        await stepUpService.consumeProof(
          transaction.stepUp,
          {
            proof: fixture.proof,
            action: StepUpAction.CERTIFICATE_ISSUE,
            targetType: StepUpTargetType.ENROLLMENT,
            targetId: fixture.enrollment.id,
          },
          adminActor(),
          { actorUserId: adminId },
        );
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const proofAfter = await client.stepUpProof.findUniqueOrThrow({
      where: { id: proofBefore.id },
    });
    expect(proofAfter.consumedAt).toBeNull();
    await expect(
      client.auditLog.count({
        where: { action: 'security.step_up.proof_consumed', subjectId: proofBefore.id },
      }),
    ).resolves.toBe(0);
  });

  it('allows one winner under concurrent issuance and leaves one certificate and artifact', async () => {
    const fixture = await createEligibleEnrollment('concurrent');
    const secondProof = await createProof(fixture.enrollment.id);
    const filesBefore = new Set(await readdir(storageRoot, { recursive: true }));
    const results = await Promise.allSettled([
      service.issueCertificate(fixture.command, adminActor(), { actorUserId: adminId }),
      service.issueCertificate(
        {
          ...fixture.command,
          idempotencyKey: `concurrent-${randomUUID()}`,
          stepUpProof: secondProof,
        },
        adminActor(),
        { actorUserId: adminId },
      ),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find(({ status }) => status === 'rejected');
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'CERTIFICATE_ALREADY_ISSUED' }),
    });
    const certificate = await client.certificate.findUniqueOrThrow({
      where: { enrollmentId: fixture.enrollment.id },
      include: { artifact: true },
    });
    expect(certificate.artifact).not.toBeNull();
    await expect(
      client.certificate.count({ where: { enrollmentId: fixture.enrollment.id } }),
    ).resolves.toBe(1);
    await expect(
      client.certificateArtifact.count({ where: { certificateId: certificate.id } }),
    ).resolves.toBe(1);
    const filesAfter = await readdir(storageRoot, { recursive: true });
    const newPdfFiles = filesAfter.filter(
      (file) => file.endsWith('.pdf') && !filesBefore.has(file),
    );
    expect(newPdfFiles).toHaveLength(1);
    expect(filesAfter.filter((file) => file.endsWith('.stage'))).toHaveLength(0);
    const persistedBytes = await readFile(join(storageRoot, certificate.artifact!.storageKey));
    expect(persistedBytes).toHaveLength(Number(certificate.artifact!.sizeBytes));
    expect(createHash('sha256').update(persistedBytes).digest('hex')).toBe(
      certificate.artifact!.checksum,
    );
  }, 30_000);

  it('replay-resolves concurrent requests with the identical idempotency key and proof', async () => {
    const fixture = await createEligibleEnrollment('same-key');
    const filesBefore = new Set(await readdir(storageRoot, { recursive: true }));
    const results = await Promise.all([
      service.issueCertificate(fixture.command, adminActor(), { actorUserId: adminId }),
      service.issueCertificate(fixture.command, adminActor(), { actorUserId: adminId }),
    ]);
    expect(results[1]).toEqual(results[0]);
    const certificate = await client.certificate.findUniqueOrThrow({
      where: { enrollmentId: fixture.enrollment.id },
      include: { artifact: true },
    });
    await expect(
      client.idempotencyRecord.count({
        where: { actorUserId: adminId, key: fixture.command.idempotencyKey },
      }),
    ).resolves.toBe(1);
    await expect(
      client.auditLog.count({ where: { action: 'certificate.issued', subjectId: certificate.id } }),
    ).resolves.toBe(1);
    await expect(
      client.stepUpProof.count({
        where: { targetId: fixture.enrollment.id, consumedAt: { not: null } },
      }),
    ).resolves.toBe(1);
    const filesAfter = await readdir(storageRoot, { recursive: true });
    expect(
      filesAfter.filter((file) => file.endsWith('.pdf') && !filesBefore.has(file)),
    ).toHaveLength(1);
    expect(filesAfter.filter((file) => file.endsWith('.stage'))).toHaveLength(0);
  }, 30_000);

  it.each([
    [
      'recipient name',
      async (fixture: Awaited<ReturnType<typeof createEligibleEnrollment>>) => {
        await client.user.update({
          where: { id: fixture.student.id },
          data: { displayName: 'Renderdan keyingi ism' },
        });
      },
    ],
    [
      'course title',
      async () => {
        await client.course.update({
          where: { id: courseId },
          data: { title: 'Renderdan keyingi kurs' },
        });
      },
    ],
  ])(
    'rejects a changed %s snapshot and leaves the proof unused',
    async (_label, mutate) => {
      const fixture = await createEligibleEnrollment(`snapshot-${suffix()}`);
      const originalTitle = await client.course
        .findUniqueOrThrow({ where: { id: courseId }, select: { title: true } })
        .then(({ title }) => title);
      const originalPrepare = artifactService.prepareCertificateArtifact.bind(artifactService);
      const mutatingArtifacts = Object.create(artifactService) as CertificateArtifactService;
      mutatingArtifacts.prepareCertificateArtifact = async (input) => {
        const prepared = await originalPrepare(input);
        await mutate(fixture);
        return prepared;
      };
      const isolatedService = new CertificateIssuanceService(
        issuanceRepository,
        mutatingArtifacts,
        stepUpService,
      );
      try {
        await expect(
          isolatedService.issueCertificate(fixture.command, adminActor(), {
            actorUserId: adminId,
          }),
        ).rejects.toMatchObject({ code: 'CERTIFICATE_EVIDENCE_CONFLICT' });
        await expect(
          client.certificate.count({ where: { enrollmentId: fixture.enrollment.id } }),
        ).resolves.toBe(0);
        await expect(
          client.stepUpProof.findFirstOrThrow({ where: { targetId: fixture.enrollment.id } }),
        ).resolves.toMatchObject({ consumedAt: null });
      } finally {
        await client.course.update({ where: { id: courseId }, data: { title: originalTitle } });
      }
    },
    30_000,
  );

  it('keeps the immutable issued course title after the mutable course is edited', async () => {
    const fixture = await createEligibleEnrollment('immutable-title');
    const issued = await service.issueCertificate(fixture.command, adminActor(), {
      actorUserId: adminId,
    });
    const original = await issuanceRepository.findCertificate(issued.response.data.certificateId);
    await client.course.update({
      where: { id: courseId },
      data: { title: 'Yangi kurs nomi', teacherId: adminId },
    });
    const after = await issuanceRepository.findCertificate(issued.response.data.certificateId);
    expect(after?.courseTitle).toBe(original?.courseTitle);
    expect(after?.courseTitle).not.toBe('Yangi kurs nomi');
    const studentDetail = await service.getOwnCertificate(
      issued.response.data.certificateId,
      {
        userId: fixture.student.id,
        sessionId,
        roles: [RoleCode.STUDENT],
        permissions: ['certificates.self_read'],
      },
      { actorUserId: fixture.student.id },
    );
    const adminDetail = await service.getCourseCertificate(
      courseId,
      issued.response.data.certificateId,
      adminActor(),
      { actorUserId: adminId },
    );
    const teacherDetail = await service.getCourseCertificate(
      courseId,
      issued.response.data.certificateId,
      {
        ...adminActor(),
        roles: [RoleCode.TEACHER],
        permissions: ['certificates.course_read'],
      },
      { actorUserId: adminId },
    );
    expect([
      studentDetail.course.title,
      adminDetail.course.title,
      teacherDetail.course.title,
    ]).toEqual([original?.courseTitle, original?.courseTitle, original?.courseTitle]);
  }, 30_000);

  it('shares actor-scoped detail limits across IPs and separates route scopes and actors', async () => {
    const certificateId = randomUUID();
    for (let index = 0; index < 60; index += 1) {
      await issuanceRepository.recordDetailAccess(certificateId, 'self', {
        actorUserId: adminId,
        ipHash: index % 2 === 0 ? 'a'.repeat(64) : 'b'.repeat(64),
      });
    }
    await expect(
      issuanceRepository.recordDetailAccess(certificateId, 'self', {
        actorUserId: adminId,
        ipHash: 'c'.repeat(64),
      }),
    ).rejects.toMatchObject({ name: 'CertificateRateLimitRepositoryError' });
    await expect(
      issuanceRepository.recordDetailAccess(certificateId, 'course', {
        actorUserId: adminId,
      }),
    ).resolves.toBeUndefined();

    const otherActor = await client.user.create({
      data: { email: `rate-limit-${randomUUID()}@example.com` },
    });
    await expect(
      issuanceRepository.recordDetailAccess(certificateId, 'self', {
        actorUserId: otherActor.id,
      }),
    ).resolves.toBeUndefined();
  }, 60_000);

  it('serializes the shared actor download bucket across different certificates', async () => {
    const downloadActor = await client.user.create({
      data: { email: `download-rate-limit-${randomUUID()}@example.com` },
    });
    const results = await Promise.allSettled(
      Array.from({ length: 21 }, () =>
        issuanceRepository.recordDownloadStarted(randomUUID(), 'admin', {
          actorUserId: downloadActor.id,
        }),
      ),
    );

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(20);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ name: 'CertificateRateLimitRepositoryError' }),
    });
    await expect(
      client.auditLog.count({
        where: {
          actorUserId: downloadActor.id,
          action: 'certificate.download_started',
        },
      }),
    ).resolves.toBe(20);
  }, 60_000);

  it('verifies the SHA-256 capability through the real database with a privacy-only DTO', async () => {
    const fixture = await createDirectCertificate('public');
    const originalCourseTitle = await client.course
      .findUniqueOrThrow({ where: { id: courseId }, select: { title: true } })
      .then(({ title }) => title);
    await client.course.update({
      where: { id: courseId },
      data: { title: 'Mutable course title after issuance' },
    });

    try {
      const result = await service.verifyPublicCertificate(fixture.verificationIdentifier, {
        ipHash: '1'.repeat(64),
      });
      expect(result).toEqual({
        certificateNumber: fixture.certificate.certificateNumber,
        status: 'VALID',
        recipientDisplayName: fixture.certificate.recipientDisplayName,
        courseTitle: 'O\u2018zgarmas kurs public',
        organizationName: 'Turk Tili LMS',
        issuedAt: fixture.certificate.issuedAt.toISOString(),
        revokedAt: null,
        safeRevocationReasonCode: null,
      });
      expect(Object.keys(result)).not.toEqual(
        expect.arrayContaining([
          'id',
          'level',
          'courseId',
          'enrollmentId',
          'verificationTokenHash',
          'artifact',
        ]),
      );
      const audit = await client.auditLog.findFirstOrThrow({
        where: {
          action: 'certificate.verification_viewed',
          ipHash: '1'.repeat(64),
        },
      });
      expect(audit).toMatchObject({
        actorUserId: null,
        subjectId: null,
        metadata: { outcome: 'found' },
      });
      const serializedAudit = JSON.stringify(audit);
      expect(serializedAudit).not.toContain(fixture.verificationIdentifier);
      expect(serializedAudit).not.toContain(
        createHash('sha256').update(fixture.verificationIdentifier).digest('hex'),
      );
    } finally {
      await client.course.update({
        where: { id: courseId },
        data: { title: originalCourseTitle },
      });
    }
  }, 30_000);

  it('uses uniform public not-found semantics and a shared PostgreSQL rate limit', async () => {
    await expect(
      service.verifyPublicCertificate('malformed', { ipHash: '2'.repeat(64) }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CERTIFICATE_VERIFICATION_NOT_FOUND',
    });
    await expect(
      service.verifyPublicCertificate(randomBytes(32).toString('base64url'), {
        ipHash: '3'.repeat(64),
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CERTIFICATE_VERIFICATION_NOT_FOUND',
    });

    const fixture = await createDirectCertificate('public-rate');
    await Promise.all(
      Array.from({ length: 20 }, () =>
        service.verifyPublicCertificate(fixture.verificationIdentifier, {
          ipHash: '4'.repeat(64),
        }),
      ),
    );
    await expect(
      service.verifyPublicCertificate(fixture.verificationIdentifier, {
        ipHash: '4'.repeat(64),
      }),
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' });
    await expect(
      client.auditLog.count({
        where: {
          action: 'certificate.verification_viewed',
          ipHash: '4'.repeat(64),
        },
      }),
    ).resolves.toBe(20);
  }, 60_000);

  it('atomically revokes once without mutating the artifact and immediately verifies as revoked', async () => {
    const fixture = await createDirectCertificate('revoke-atomic');
    const proof = await createRevocationProof(fixture.certificate.id);
    const artifactBefore = await client.certificateArtifact.findUniqueOrThrow({
      where: { certificateId: fixture.certificate.id },
    });
    const command = {
      certificateId: fixture.certificate.id,
      idempotencyKey: `revoke-${randomUUID()}`,
      stepUpProof: proof,
      input: {
        expectedVersion: 1,
        reasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
        reasonNote: 'Tasdiqlangan ma\u2018muriy tuzatish.',
        confirmed: true as const,
      },
    };

    const first = await service.revokeCertificate(command, adminActor(), {
      actorUserId: adminId,
    });
    const second = await service.revokeCertificate(
      { ...command, stepUpProof: 'X'.repeat(43) },
      adminActor(),
      { actorUserId: adminId },
    );
    expect(second).toEqual(first);

    const [certificate, storedProof, artifactAfter, idempotency, audits] = await Promise.all([
      client.certificate.findUniqueOrThrow({
        where: { id: fixture.certificate.id },
      }),
      client.stepUpProof.findFirstOrThrow({
        where: {
          targetId: fixture.certificate.id,
          action: StepUpAction.CERTIFICATE_REVOKE,
        },
      }),
      client.certificateArtifact.findUniqueOrThrow({
        where: { certificateId: fixture.certificate.id },
      }),
      client.idempotencyRecord.findUniqueOrThrow({
        where: {
          actorUserId_key: {
            actorUserId: adminId,
            key: command.idempotencyKey,
          },
        },
      }),
      client.auditLog.findMany({
        where: {
          subjectId: fixture.certificate.id,
          action: 'certificate.revoked',
        },
      }),
    ]);
    expect(certificate).toMatchObject({
      status: CertificateLifecycleStatus.REVOKED,
      version: 2,
      revokedByUserId: adminId,
      revocationReasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
      revocationReasonNote: 'Tasdiqlangan ma\u2018muriy tuzatish.',
    });
    expect(certificate.revokedAt).toBeInstanceOf(Date);
    expect(storedProof.consumedAt).toEqual(certificate.revokedAt);
    expect(artifactAfter).toEqual(artifactBefore);
    expect(idempotency).toMatchObject({
      operation: 'REVOKE_CERTIFICATE',
      responseStatus: 200,
      resultingCertificateId: fixture.certificate.id,
      resultingCertificateVersion: 2,
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toEqual({
      certificateNumber: fixture.certificate.certificateNumber,
      previousStatus: 'ISSUED',
      newStatus: 'REVOKED',
      previousVersion: 1,
      newVersion: 2,
      reasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
    });
    expect(JSON.stringify(audits)).not.toContain(proof);
    expect(JSON.stringify(audits)).not.toContain(fixture.certificate.verificationTokenHash);
    await expect(
      service.verifyPublicCertificate(fixture.verificationIdentifier, {
        ipHash: '5'.repeat(64),
      }),
    ).resolves.toMatchObject({
      status: 'REVOKED',
      revokedAt: certificate.revokedAt?.toISOString(),
      safeRevocationReasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
    });

    const duplicateProof = await createRevocationProof(fixture.certificate.id);
    await expect(
      service.revokeCertificate(
        {
          ...command,
          idempotencyKey: `duplicate-${randomUUID()}`,
          stepUpProof: duplicateProof,
        },
        adminActor(),
        { actorUserId: adminId },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ALREADY_REVOKED' });
    await expect(
      client.stepUpProof.findFirstOrThrow({
        where: { proofHash: new NodeStepUpCryptoService().hash(duplicateProof) },
      }),
    ).resolves.toMatchObject({ consumedAt: null });
  }, 60_000);

  it('serializes same-key and different-key revocation races safely', async () => {
    const sameKeyFixture = await createDirectCertificate('revoke-same-key');
    const sameKeyProof = await createRevocationProof(sameKeyFixture.certificate.id);
    const sameKeyCommand = {
      certificateId: sameKeyFixture.certificate.id,
      idempotencyKey: `same-revoke-${randomUUID()}`,
      stepUpProof: sameKeyProof,
      input: {
        expectedVersion: 1,
        reasonCode: CertificateRevocationReasonCode.POLICY_VIOLATION,
        reasonNote: 'Tasdiqlangan siyosat buzilishi.',
        confirmed: true as const,
      },
    };
    const sameKeyResults = await Promise.all([
      service.revokeCertificate(sameKeyCommand, adminActor(), {
        actorUserId: adminId,
      }),
      service.revokeCertificate(sameKeyCommand, adminActor(), {
        actorUserId: adminId,
      }),
    ]);
    expect(sameKeyResults[1]).toEqual(sameKeyResults[0]);
    await expect(
      client.auditLog.count({
        where: {
          action: 'certificate.revoked',
          subjectId: sameKeyFixture.certificate.id,
        },
      }),
    ).resolves.toBe(1);

    const competingFixture = await createDirectCertificate('revoke-different-key');
    const [proofA, proofB] = await Promise.all([
      createRevocationProof(competingFixture.certificate.id),
      createRevocationProof(competingFixture.certificate.id),
    ]);
    const baseCommand = {
      certificateId: competingFixture.certificate.id,
      input: {
        expectedVersion: 1,
        reasonCode: CertificateRevocationReasonCode.FRAUD,
        reasonNote: 'Tasdiqlangan firibgarlik holati.',
        confirmed: true as const,
      },
    };
    const competingResults = await Promise.allSettled([
      service.revokeCertificate(
        {
          ...baseCommand,
          idempotencyKey: `revoke-a-${randomUUID()}`,
          stepUpProof: proofA,
        },
        adminActor(),
        { actorUserId: adminId },
      ),
      service.revokeCertificate(
        {
          ...baseCommand,
          idempotencyKey: `revoke-b-${randomUUID()}`,
          stepUpProof: proofB,
        },
        adminActor(),
        { actorUserId: adminId },
      ),
    ]);
    expect(competingResults.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(competingResults.find(({ status }) => status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({
        code: expect.stringMatching(
          /^(CERTIFICATE_ALREADY_REVOKED|CERTIFICATE_VERSION_CONFLICT)$/u,
        ),
      }),
    });
    await expect(
      client.auditLog.count({
        where: {
          action: 'certificate.revoked',
          subjectId: competingFixture.certificate.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      client.stepUpProof.count({
        where: {
          targetId: competingFixture.certificate.id,
          action: StepUpAction.CERTIFICATE_REVOKE,
          consumedAt: { not: null },
        },
      }),
    ).resolves.toBe(1);
  }, 60_000);

  it('rolls back revocation proof consumption with certificate and audit state unchanged', async () => {
    const fixture = await createDirectCertificate('revoke-rollback');
    const proof = await createRevocationProof(fixture.certificate.id);
    const idempotencyKey = `rollback-${randomUUID()}`;

    await expect(
      issuanceRepository.withSerializableTransaction(async (transaction) => {
        const consumed = await stepUpService.consumeProof(
          transaction.stepUp,
          {
            proof,
            action: StepUpAction.CERTIFICATE_REVOKE,
            targetType: StepUpTargetType.CERTIFICATE,
            targetId: fixture.certificate.id,
          },
          adminActor(),
          { actorUserId: adminId },
        );
        await transaction.lockCertificate(fixture.certificate.id);
        await transaction.lockIdempotencyKey(adminId, idempotencyKey);
        const certificate = await transaction.findCertificateForRevocation(fixture.certificate.id);
        if (!certificate) throw new Error('rollback fixture certificate missing');
        const response = {
          success: true as const,
          message: 'Sertifikat muvaffaqiyatli bekor qilindi.',
          data: {
            operation: 'REVOKE' as const,
            certificateId: certificate.id,
            enrollmentId: certificate.enrollmentId,
            certificateNumber: certificate.certificateNumber,
            resultingStatus: 'REVOKED' as const,
            resultingVersion: 2 as const,
            occurredAt: consumed.consumedAt.toISOString(),
          },
        };
        await transaction.revokeCertificate({
          certificate,
          actorUserId: adminId,
          reasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
          reasonNote: 'Tasdiqlangan rollback tekshiruvi.',
          revokedAt: consumed.consumedAt,
          idempotencyKey,
          requestFingerprint: 'f'.repeat(64),
          responseEnvelope: response,
          audit: { actorUserId: adminId },
        });
        throw new Error('force revocation rollback');
      }),
    ).rejects.toThrow('force revocation rollback');

    await expect(
      client.certificate.findUniqueOrThrow({
        where: { id: fixture.certificate.id },
      }),
    ).resolves.toMatchObject({
      status: CertificateLifecycleStatus.ISSUED,
      version: 1,
      revokedAt: null,
      revokedByUserId: null,
    });
    const storedProof = await client.stepUpProof.findFirstOrThrow({
      where: {
        targetId: fixture.certificate.id,
        action: StepUpAction.CERTIFICATE_REVOKE,
      },
    });
    expect(storedProof).toMatchObject({ consumedAt: null });
    const [revocationAudits, proofConsumptionAudits, idempotency] = await Promise.all([
      client.auditLog.count({
        where: {
          action: 'certificate.revoked',
          subjectId: fixture.certificate.id,
        },
      }),
      client.auditLog.count({
        where: {
          action: 'security.step_up.proof_consumed',
          subjectType: 'step_up_proof',
          subjectId: storedProof.id,
        },
      }),
      client.idempotencyRecord.findUnique({
        where: { actorUserId_key: { actorUserId: adminId, key: idempotencyKey } },
      }),
    ]);
    expect(revocationAudits).toBe(0);
    expect(proofConsumptionAudits).toBe(0);
    expect(idempotency).toBeNull();
  }, 30_000);
});
