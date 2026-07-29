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
      permissions: ['certificates.issue', 'certificates.course_read', 'certificates.download'],
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
    const permission = await client.permission.create({
      data: {
        code: 'certificates.issue',
        resource: 'certificates',
        action: 'issue',
      },
    });
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
    await client.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: permission.id },
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
    await client.certificateTemplateVersion.create({
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
});
