import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CertificateArtifactStorageProvider,
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
  IdempotencyOperation,
  Prisma,
  PrismaClient,
  SessionClientType,
  StepUpAction,
  StepUpContinuation,
  StepUpTargetType,
} from '@prisma/client';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');
const migrationDirectory = resolve(
  backendRoot,
  'prisma',
  'migrations',
  '20260728193000_add_certificate_lifecycle_foundation',
);
const preflightScriptPath = resolve(migrationDirectory, 'preflight.sql');
const rollbackScriptPath = resolve(migrationDirectory, 'rollback.sql');
const verificationScriptPath = resolve(migrationDirectory, 'verification.sql');

const expectedTables = [
  'certificate_artifacts',
  'certificate_disclosure_controls',
  'certificate_template_versions',
  'certificate_templates',
  'certificates',
  'step_up_challenges',
  'step_up_proofs',
] as const;

const expectedChecks = [
  'certificate_artifacts_pdf_shape_check',
  'certificate_artifacts_storage_key_check',
  'certificate_disclosure_controls_shape_check',
  'certificate_template_versions_asset_pairs_check',
  'certificate_template_versions_lifecycle_check',
  'certificate_template_versions_locale_check',
  'certificate_template_versions_renderable_shape_check',
  'certificate_template_versions_version_check',
  'certificate_templates_code_shape_check',
  'certificates_lifecycle_shape_check',
  'certificates_number_shape_check',
  'certificates_snapshot_shape_check',
  'certificates_verification_hash_check',
  'idempotency_records_result_shape_check',
  'step_up_challenges_attempt_check',
  'step_up_challenges_binding_check',
  'step_up_challenges_hash_check',
  'step_up_challenges_time_check',
  'step_up_proofs_binding_check',
  'step_up_proofs_hash_check',
  'step_up_proofs_time_check',
] as const;

const expectedTriggers = [
  'certificate_artifacts_immutable_guard',
  'certificate_template_versions_immutable_guard',
  'certificate_templates_identity_guard',
  'certificates_lifecycle_guard',
  'idempotency_records_immutable_guard',
  'step_up_challenges_lifecycle_guard',
  'step_up_proofs_challenge_state_guard',
  'step_up_proofs_single_use_guard',
] as const;

const expectedIndexes = [
  'certificate_artifacts_certificate_id_key',
  'certificate_artifacts_checksum_idx',
  'certificate_artifacts_finalized_at_idx',
  'certificate_artifacts_provider_finalized_at_idx',
  'certificate_artifacts_storage_key_key',
  'certificate_disclosure_controls_actor_suppressed_at_idx',
  'certificate_disclosure_controls_certificate_id_key',
  'certificate_disclosure_controls_suppressed_at_idx',
  'certificate_template_versions_active_key',
  'certificate_template_versions_identity_key',
  'certificate_template_versions_lookup_idx',
  'certificate_template_versions_status_locale_idx',
  'certificate_templates_code_key',
  'certificates_certificate_number_key',
  'certificates_course_id_status_issued_at_idx',
  'certificates_eligibility_evaluation_id_key',
  'certificates_enrollment_course_key',
  'certificates_enrollment_id_key',
  'certificates_enrollment_id_status_idx',
  'certificates_evaluation_enrollment_course_key',
  'certificates_id_enrollment_id_key',
  'certificates_issued_by_user_id_issued_at_idx',
  'certificates_revoked_by_user_id_revoked_at_idx',
  'certificates_template_version_id_idx',
  'certificates_verification_token_hash_key',
  'eligibility_evaluations_id_enrollment_course_key',
  'idempotency_records_resulting_certificate_id_idx',
  'step_up_challenges_continuation_id_key',
  'step_up_challenges_expires_locked_at_idx',
  'step_up_challenges_nonce_hash_key',
  'step_up_challenges_proof_binding_key',
  'step_up_challenges_target_action_idx',
  'step_up_challenges_user_session_expires_at_idx',
  'step_up_proofs_challenge_binding_key',
  'step_up_proofs_challenge_id_key',
  'step_up_proofs_expires_consumed_at_idx',
  'step_up_proofs_proof_hash_key',
  'step_up_proofs_target_action_idx',
  'step_up_proofs_user_session_active_idx',
  'user_sessions_id_user_id_key',
] as const;

function randomSchemaSuffix(): string {
  return randomUUID().replaceAll('-', '');
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function hasDatabaseMessage(error: unknown, text: string): boolean {
  return error instanceof Error && error.message.includes(text);
}

function isConstraintError(error: unknown, constraintName: string): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(constraintName) ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        String(error.meta?.database_error).includes(constraintName)))
  );
}

function utcDate(timestamp: Date): Date {
  return new Date(
    Date.UTC(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()),
  );
}

describeDatabase('Module 8.6B certificate lifecycle PostgreSQL foundation', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `certificate_lifecycle_test_${randomSchemaSuffix()}`;
  const rollbackSchemaName = `certificate_lifecycle_rollback_${randomSchemaSuffix()}`;
  let isolatedDatabaseUrl = '';
  let client: PrismaClient;
  let adminUserId = '';
  let credentialEpoch: Date;
  let adminSessionId = '';
  let courseId = '';
  let policyId = '';
  let templateId = '';
  let activeTemplateVersionId = '';
  let initialFoundationCounts: readonly number[] = [];

  async function deployMigrations(databaseUrl: string): Promise<void> {
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      windowsHide: true,
    });
  }

  async function executeSqlFile(path: string, databaseUrl: string): Promise<void> {
    await execFileAsync(
      process.execPath,
      [prismaCliPath, 'db', 'execute', '--file', path, '--url', databaseUrl],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        windowsHide: true,
      },
    );
  }

  async function createEligibleContext(label: string): Promise<{
    enrollmentId: string;
    evaluationId: string;
  }> {
    const student = await client.user.create({
      data: { email: `certificate-${label}-${randomUUID()}@example.com` },
    });
    const completedAt = new Date(Date.now() - 10_000);
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId,
        studentId: student.id,
        source: CourseEnrollmentSource.SELF,
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt,
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
    const evaluation = await client.certificateEligibilityEvaluation.create({
      data: {
        enrollmentId: enrollment.id,
        courseId,
        policyId,
        status: CertificateEligibilityStatus.ELIGIBLE,
        evaluationVersion: 1,
        evaluatedAt: new Date(),
        completedAt,
        completionCurriculumVersion: 1,
        completionVersion: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
      },
    });
    return { enrollmentId: enrollment.id, evaluationId: evaluation.id };
  }

  async function createCertificate(
    label: string,
    overrides: {
      certificateNumber?: string;
      verificationTokenHash?: string;
    } = {},
  ) {
    const context = await createEligibleContext(label);
    const issuedAt = new Date();
    const certificate = await client.certificate.create({
      data: {
        ...overrides,
        verificationTokenHash:
          overrides.verificationTokenHash ?? Buffer.from(randomUUID()).toString('hex').slice(0, 64),
        enrollmentId: context.enrollmentId,
        courseId,
        eligibilityEvaluationId: context.evaluationId,
        templateVersionId: activeTemplateVersionId,
        recipientDisplayName: `Learner ${label}`,
        courseTitle: 'Certificate lifecycle course',
        organizationName: 'Turk Tili LMS',
        locale: 'uz-Latn',
        issueDate: utcDate(issuedAt),
        issuedAt,
        issuedByUserId: adminUserId,
      },
    });
    return { ...context, certificate };
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^certificate_lifecycle_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated test schema name is invalid.');
    }

    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    isolatedDatabaseUrl = url.toString();

    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${schemaName}"."citext" AS public.citext`,
    );
    await deployMigrations(isolatedDatabaseUrl);
    client = new PrismaClient({ datasourceUrl: isolatedDatabaseUrl });

    initialFoundationCounts = await Promise.all([
      client.certificate.count(),
      client.certificateArtifact.count(),
      client.certificateDisclosureControl.count(),
      client.certificateTemplate.count(),
      client.certificateTemplateVersion.count(),
      client.stepUpChallenge.count(),
      client.stepUpProof.count(),
      client.idempotencyRecord.count({
        where: {
          operation: {
            in: [IdempotencyOperation.ISSUE_CERTIFICATE, IdempotencyOperation.REVOKE_CERTIFICATE],
          },
        },
      }),
    ]);

    const admin = await client.user.create({
      data: {
        email: `certificate-admin-${randomUUID()}@example.com`,
        credential: { create: { passwordHash: '$2b$10$database.foundation.placeholder' } },
      },
      include: { credential: true },
    });
    adminUserId = admin.id;
    credentialEpoch = admin.credential!.passwordChangedAt;
    const session = await client.userSession.create({
      data: {
        userId: admin.id,
        refreshTokenHash: Buffer.from(randomUUID()).toString('hex').slice(0, 64),
        tokenFamilyId: randomUUID(),
        clientType: SessionClientType.WEB,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    adminSessionId = session.id;

    const course = await client.course.create({
      data: {
        title: 'Certificate lifecycle course',
        slug: `certificate-lifecycle-${randomUUID()}`,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: admin.id,
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

    const template = await client.certificateTemplate.create({
      data: { code: 'STANDARD_COURSE_COMPLETION', name: 'Standard Course Completion' },
    });
    templateId = template.id;
    const activatedAt = new Date();
    const versionCreatedAt = new Date(activatedAt.getTime() - 1);
    const templateVersion = await client.certificateTemplateVersion.create({
      data: {
        templateId,
        version: 1,
        locale: 'uz-Latn',
        status: CertificateTemplateVersionStatus.ACTIVE,
        rendererContractVersion: 'certificate-pdf-v1',
        organizationDisplayName: 'Turk Tili LMS',
        organizationLegalName: 'Turk Tili LMS',
        fontAssetId: 'bundled-font-v1',
        fontAssetChecksum: 'a'.repeat(64),
        fontFamily: 'Approved Unicode Font',
        fontVersion: '1.0.0',
        fontLicenseIdentifier: 'OFL-1.1',
        fontLicenseProvenance: 'Bundled and reviewed test fixture',
        activatedAt,
        createdAt: versionCreatedAt,
      },
    });
    activeTemplateVersionId = templateVersion.id;
  }, 90_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (/^certificate_lifecycle_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    if (/^certificate_lifecycle_rollback_[a-f0-9]{32}$/u.test(rollbackSchemaName)) {
      await administrationClient.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${rollbackSchemaName}" CASCADE`,
      );
    }
    await administrationClient.$disconnect();
  });

  it('applies tables, checks, restrictive foreign keys, indexes, and immutability triggers', async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY(${expectedTables})
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual([...expectedTables]);

    const checks = await client.$queryRaw<Array<{ conname: string; convalidated: boolean }>>`
      SELECT conname, convalidated
      FROM pg_catalog.pg_constraint
      WHERE connamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema()
      )
        AND conname = ANY(${expectedChecks})
      ORDER BY conname
    `;
    expect(checks.map(({ conname }) => conname)).toEqual([...expectedChecks]);
    expect(checks.every(({ convalidated }) => convalidated)).toBe(true);

    const triggers = await client.$queryRaw<Array<{ trigger_name: string }>>`
      SELECT DISTINCT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = current_schema()
        AND trigger_name = ANY(${expectedTriggers})
      ORDER BY trigger_name
    `;
    expect(triggers.map(({ trigger_name }) => trigger_name)).toEqual([...expectedTriggers]);

    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_catalog.pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = ANY(${expectedIndexes})
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual([...expectedIndexes]);

    const moduleForeignKeys = await client.$queryRaw<
      Array<{ conname: string; confdeltype: string }>
    >`
      SELECT conname, confdeltype::TEXT
      FROM pg_catalog.pg_constraint
      WHERE connamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema()
      )
        AND contype = 'f'
        AND (
          conrelid IN (
            'certificate_template_versions'::REGCLASS,
            'certificates'::REGCLASS,
            'certificate_artifacts'::REGCLASS,
            'certificate_disclosure_controls'::REGCLASS,
            'step_up_challenges'::REGCLASS,
            'step_up_proofs'::REGCLASS
          )
          OR conname IN (
            'idempotency_records_enrollment_id_fkey',
            'idempotency_records_resulting_certificate_id_fkey'
          )
        )
    `;
    expect(moduleForeignKeys.length).toBeGreaterThanOrEqual(14);
    expect(moduleForeignKeys.every(({ confdeltype }) => confdeltype === 'r')).toBe(true);

    const idempotencyTarget = await client.$queryRaw<Array<{ target: string }>>`
      SELECT target.relname AS target
      FROM pg_catalog.pg_constraint AS relation_constraint
      JOIN pg_catalog.pg_class AS source ON source.oid = relation_constraint.conrelid
      JOIN pg_catalog.pg_class AS target ON target.oid = relation_constraint.confrelid
      WHERE source.relname = 'idempotency_records'
        AND relation_constraint.conname = 'idempotency_records_enrollment_id_fkey'
        AND relation_constraint.connamespace = (
          SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema()
        )
    `;
    expect(idempotencyTarget).toEqual([{ target: 'course_enrollments' }]);
  });

  it('creates no fabricated certificate, artifact, template-version, proof, or receipt data', () => {
    expect(initialFoundationCounts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('persists issued certificate identity with database-owned numbering and exact evidence scope', async () => {
    const { certificate, enrollmentId, evaluationId } = await createCertificate('identity');
    expect(certificate).toMatchObject({
      enrollmentId,
      courseId,
      eligibilityEvaluationId: evaluationId,
      status: CertificateLifecycleStatus.ISSUED,
      version: 1,
      revokedAt: null,
      revokedByUserId: null,
    });
    expect(certificate.certificateNumber).toMatch(/^TTL-[0-9]{4}-[0-9]{10}$/u);
    expect(certificate.verificationTokenHash).toMatch(/^[0-9a-f]{64}$/u);

    await expect(
      client.certificate.update({
        where: { id: certificate.id },
        data: { courseTitle: 'Mutated historical title' },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'certificate facts are immutable'),
    );
  });

  it('enforces number, verification hash, enrollment, and evaluation uniqueness', async () => {
    const first = await createCertificate('unique-first');
    const secondContext = await createEligibleContext('unique-second');
    const issuedAt = new Date();

    await expect(
      client.certificate.create({
        data: {
          certificateNumber: first.certificate.certificateNumber,
          verificationTokenHash: 'b'.repeat(64),
          enrollmentId: secondContext.enrollmentId,
          courseId,
          eligibilityEvaluationId: secondContext.evaluationId,
          templateVersionId: activeTemplateVersionId,
          recipientDisplayName: 'Duplicate number',
          courseTitle: 'Certificate lifecycle course',
          organizationName: 'Turk Tili LMS',
          locale: 'uz-Latn',
          issueDate: utcDate(issuedAt),
          issuedAt,
          issuedByUserId: adminUserId,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));

    const thirdContext = await createEligibleContext('unique-third');
    await expect(
      client.certificate.create({
        data: {
          verificationTokenHash: first.certificate.verificationTokenHash,
          enrollmentId: thirdContext.enrollmentId,
          courseId,
          eligibilityEvaluationId: thirdContext.evaluationId,
          templateVersionId: activeTemplateVersionId,
          recipientDisplayName: 'Duplicate hash',
          courseTitle: 'Certificate lifecycle course',
          organizationName: 'Turk Tili LMS',
          locale: 'uz-Latn',
          issueDate: utcDate(issuedAt),
          issuedAt,
          issuedByUserId: adminUserId,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));

    const invalidShapeContext = await createEligibleContext('invalid-identity-shape');
    await expect(
      client.certificate.create({
        data: {
          certificateNumber: 'INVALID',
          verificationTokenHash: 'not-a-sha256',
          enrollmentId: invalidShapeContext.enrollmentId,
          courseId,
          eligibilityEvaluationId: invalidShapeContext.evaluationId,
          templateVersionId: activeTemplateVersionId,
          recipientDisplayName: 'Invalid identity',
          courseTitle: 'Certificate lifecycle course',
          organizationName: 'Turk Tili LMS',
          locale: 'uz-Latn',
          issueDate: utcDate(issuedAt),
          issuedAt,
          issuedByUserId: adminUserId,
        },
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        isConstraintError(error, 'certificates_number_shape_check') ||
        isConstraintError(error, 'certificates_verification_hash_check'),
    );

    const mismatchedScope = await createEligibleContext('mismatched-scope');
    await expect(
      client.certificate.create({
        data: {
          verificationTokenHash: '9'.repeat(64),
          enrollmentId: mismatchedScope.enrollmentId,
          courseId: randomUUID(),
          eligibilityEvaluationId: mismatchedScope.evaluationId,
          templateVersionId: activeTemplateVersionId,
          recipientDisplayName: 'Mismatched scope',
          courseTitle: 'Certificate lifecycle course',
          organizationName: 'Turk Tili LMS',
          locale: 'uz-Latn',
          issueDate: utcDate(issuedAt),
          issuedAt,
          issuedByUserId: adminUserId,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2003'));
  });

  it('enforces revocation field consistency and permits only one immutable transition', async () => {
    const { certificate } = await createCertificate('revocation');

    await expect(
      client.$executeRaw`
        UPDATE certificates
        SET status = 'REVOKED', version = 2, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${certificate.id}::UUID
      `,
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'certificates_lifecycle_shape_check'),
    );

    const revokedAt = new Date();
    const revoked = await client.certificate.update({
      where: { id: certificate.id },
      data: {
        status: CertificateLifecycleStatus.REVOKED,
        version: { increment: 1 },
        revokedAt,
        revokedByUserId: adminUserId,
        revocationReasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
        revocationReasonNote: 'Validated administrative correction.',
      },
    });
    expect(revoked).toMatchObject({
      status: CertificateLifecycleStatus.REVOKED,
      version: 2,
      revokedByUserId: adminUserId,
    });

    await expect(
      client.certificate.update({
        where: { id: certificate.id },
        data: { revocationReasonNote: 'Another historical reason.' },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'certificate facts are immutable'),
    );
    await expect(client.certificate.delete({ where: { id: certificate.id } })).rejects.toSatisfy(
      (error: unknown) => hasDatabaseMessage(error, 'certificate history cannot be deleted'),
    );
  });

  it('enforces canonical PDF metadata shape and immutability', async () => {
    const { certificate } = await createCertificate('artifact-valid');
    const artifact = await client.certificateArtifact.create({
      data: {
        certificateId: certificate.id,
        storageProvider: CertificateArtifactStorageProvider.LOCAL,
        storageKey: `certificates/${certificate.id}/canonical.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024n,
        checksum: 'c'.repeat(64),
        rendererIdentifier: 'typed-certificate-renderer',
        rendererVersion: '1.0.0',
        finalizedAt: new Date(Date.now() - 1_000),
      },
    });

    await expect(
      client.certificateArtifact.update({
        where: { id: artifact.id },
        data: { sizeBytes: 2048n },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'certificate artifact metadata is immutable'),
    );

    for (const invalid of [
      { mimeType: 'text/html', sizeBytes: 1n, checksum: 'd'.repeat(64) },
      { mimeType: 'application/pdf', sizeBytes: 0n, checksum: 'e'.repeat(64) },
      { mimeType: 'application/pdf', sizeBytes: 10_485_761n, checksum: 'f'.repeat(64) },
      { mimeType: 'application/pdf', sizeBytes: 1n, checksum: 'not-a-sha256' },
    ]) {
      const context = await createCertificate(`artifact-invalid-${randomUUID()}`);
      await expect(
        client.certificateArtifact.create({
          data: {
            certificateId: context.certificate.id,
            storageKey: `certificates/${context.certificate.id}/canonical.pdf`,
            rendererIdentifier: 'typed-certificate-renderer',
            rendererVersion: '1.0.0',
            finalizedAt: new Date(Date.now() - 1_000),
            ...invalid,
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, 'certificate_artifacts_pdf_shape_check'),
      );
    }

    const unsafePathCertificate = await createCertificate('artifact-unsafe-path');
    await expect(
      client.certificateArtifact.create({
        data: {
          certificateId: unsafePathCertificate.certificate.id,
          storageKey: '../outside/certificate.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1n,
          checksum: '7'.repeat(64),
          rendererIdentifier: 'typed-certificate-renderer',
          rendererVersion: '1.0.0',
          finalizedAt: new Date(Date.now() - 1_000),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'certificate_artifacts_storage_key_check'),
    );
  });

  it('enforces template identity, active uniqueness, renderable shape, and lifecycle immutability', async () => {
    await expect(
      client.certificateTemplate.update({
        where: { id: templateId },
        data: { code: 'RENAMED_TEMPLATE' },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'certificate template identity is immutable'),
    );

    await expect(
      client.certificateTemplateVersion.create({
        data: {
          templateId,
          version: 2,
          locale: 'uz-Latn',
          status: CertificateTemplateVersionStatus.ACTIVE,
          createdAt: new Date(Date.now() - 1_000),
          activatedAt: new Date(),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'certificate_template_versions_renderable_shape_check'),
    );

    await expect(
      client.certificateTemplateVersion.create({
        data: {
          templateId,
          version: 3,
          locale: 'uz-Latn',
          status: CertificateTemplateVersionStatus.ACTIVE,
          rendererContractVersion: 'certificate-pdf-v1',
          organizationDisplayName: 'Turk Tili LMS',
          organizationLegalName: 'Turk Tili LMS',
          fontAssetId: 'bundled-font-v1',
          fontAssetChecksum: '8'.repeat(64),
          fontFamily: 'Approved Unicode Font',
          fontVersion: '1.0.0',
          fontLicenseIdentifier: 'OFL-1.1',
          fontLicenseProvenance: 'Bundled and reviewed test fixture',
          createdAt: new Date(Date.now() - 1_000),
          activatedAt: new Date(),
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));

    const invalidActivationTime = new Date();
    await expect(
      client.certificateTemplateVersion.create({
        data: {
          templateId,
          version: 4,
          locale: 'tr',
          status: CertificateTemplateVersionStatus.ACTIVE,
          rendererContractVersion: 'certificate-pdf-v1',
          organizationDisplayName: 'Turk Tili LMS',
          organizationLegalName: 'Turk Tili LMS',
          fontAssetId: 'bundled-font-v1',
          fontAssetChecksum: '9'.repeat(64),
          fontFamily: 'Approved Unicode Font',
          fontVersion: '1.0.0',
          fontLicenseIdentifier: 'OFL-1.1',
          fontLicenseProvenance: 'Bundled and reviewed test fixture',
          activatedAt: new Date(invalidActivationTime.getTime() - 1),
          createdAt: invalidActivationTime,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'certificate_template_versions_lifecycle_check'),
    );

    await expect(
      client.certificateTemplateVersion.update({
        where: { id: activeTemplateVersionId },
        data: { organizationDisplayName: 'Changed organization' },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'certificate template versions are immutable'),
    );

    const retiredAt = new Date();
    await expect(
      client.certificateTemplateVersion.update({
        where: { id: activeTemplateVersionId },
        data: {
          status: CertificateTemplateVersionStatus.RETIRED,
          retiredAt,
        },
      }),
    ).resolves.toMatchObject({
      status: CertificateTemplateVersionStatus.RETIRED,
      retiredAt,
    });
  });

  it('enforces challenge binding, expiry, proof hash-only shape, and single consumption', async () => {
    const createdAt = new Date();
    const context = await createEligibleContext('step-up');
    const challenge = await client.stepUpChallenge.create({
      data: {
        userId: adminUserId,
        sessionId: adminSessionId,
        nonceHash: '1'.repeat(64),
        credentialEpoch,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
        continuationId: randomUUID(),
        expiresAt: new Date(createdAt.getTime() + 5 * 60_000),
        verifiedAt: new Date(createdAt.getTime() + 1),
        createdAt,
      },
    });

    const proof = await client.stepUpProof.create({
      data: {
        challengeId: challenge.id,
        userId: adminUserId,
        sessionId: adminSessionId,
        proofHash: '2'.repeat(64),
        credentialEpoch,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        expiresAt: new Date(createdAt.getTime() + 2 * 60_000),
        createdAt: new Date(createdAt.getTime() + 2),
      },
    });

    const consumedAt = new Date(createdAt.getTime() + 3);
    await expect(
      client.stepUpProof.update({
        where: { id: proof.id },
        data: { consumedAt },
      }),
    ).resolves.toMatchObject({ consumedAt });

    await expect(
      client.stepUpProof.update({
        where: { id: proof.id },
        data: { consumedAt: new Date(createdAt.getTime() + 4) },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'step-up proof is immutable'),
    );

    const pendingChallengeCreatedAt = new Date();
    const pendingChallenge = await client.stepUpChallenge.create({
      data: {
        userId: adminUserId,
        sessionId: adminSessionId,
        nonceHash: '6'.repeat(64),
        credentialEpoch,
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
        continuationId: randomUUID(),
        expiresAt: new Date(pendingChallengeCreatedAt.getTime() + 5 * 60_000),
        createdAt: pendingChallengeCreatedAt,
      },
    });

    await expect(
      client.stepUpChallenge.update({
        where: { id: pendingChallenge.id },
        data: { targetId: randomUUID() },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'step-up challenge security bindings are immutable'),
    );

    await expect(
      client.stepUpChallenge.update({
        where: { id: pendingChallenge.id },
        data: { attemptCount: 5 },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'step-up challenge failure count must advance monotonically'),
    );

    await expect(
      client.stepUpChallenge.create({
        data: {
          userId: adminUserId,
          sessionId: adminSessionId,
          nonceHash: '7'.repeat(64),
          credentialEpoch,
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId: context.enrollmentId,
          continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
          continuationId: randomUUID(),
          attemptCount: 5,
          expiresAt: new Date(pendingChallengeCreatedAt.getTime() + 5 * 60_000),
          createdAt: pendingChallengeCreatedAt,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'step_up_challenges_attempt_check'),
    );

    const lockedAt = new Date();
    await expect(
      client.stepUpChallenge.update({
        where: { id: pendingChallenge.id },
        data: { attemptCount: 1, lockedAt },
      }),
    ).resolves.toMatchObject({ attemptCount: 1, lockedAt });

    await expect(
      client.stepUpChallenge.update({
        where: { id: pendingChallenge.id },
        data: { attemptCount: 0, lockedAt: null },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'verified or locked step-up challenge is immutable'),
    );

    await expect(
      client.stepUpChallenge.create({
        data: {
          userId: adminUserId,
          sessionId: adminSessionId,
          nonceHash: '3'.repeat(64),
          credentialEpoch,
          action: StepUpAction.CERTIFICATE_REVOKE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId: context.enrollmentId,
          continuation: StepUpContinuation.CERTIFICATE_REVOKE_CONFIRMATION,
          continuationId: randomUUID(),
          expiresAt: new Date(createdAt.getTime() + 5 * 60_000),
          createdAt,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'step_up_challenges_binding_check'),
    );

    const expiredCreatedAt = new Date(Date.now() - 10 * 60_000);
    const expiredChallenge = await client.stepUpChallenge.create({
      data: {
        userId: adminUserId,
        sessionId: adminSessionId,
        nonceHash: '3'.repeat(64),
        credentialEpoch: new Date(expiredCreatedAt.getTime() - 1),
        action: StepUpAction.CERTIFICATE_ISSUE,
        targetType: StepUpTargetType.ENROLLMENT,
        targetId: context.enrollmentId,
        continuation: StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION,
        continuationId: randomUUID(),
        expiresAt: new Date(expiredCreatedAt.getTime() + 5 * 60_000),
        verifiedAt: new Date(expiredCreatedAt.getTime() + 1),
        createdAt: expiredCreatedAt,
      },
    });
    await expect(
      client.stepUpProof.create({
        data: {
          challengeId: expiredChallenge.id,
          userId: adminUserId,
          sessionId: adminSessionId,
          proofHash: '4'.repeat(64),
          credentialEpoch: new Date(expiredCreatedAt.getTime() - 1),
          action: StepUpAction.CERTIFICATE_ISSUE,
          targetType: StepUpTargetType.ENROLLMENT,
          targetId: context.enrollmentId,
          expiresAt: new Date(expiredCreatedAt.getTime() + 2 * 60_000),
          createdAt: new Date(expiredCreatedAt.getTime() + 2),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'step-up proof requires a current verified challenge'),
    );

    const shortLivedCreatedAt = new Date();
    const shortLivedChallenge = await client.stepUpChallenge.create({
      data: {
        userId: adminUserId,
        sessionId: adminSessionId,
        nonceHash: '5'.repeat(64),
        credentialEpoch,
        action: StepUpAction.CERTIFICATE_REVOKE,
        targetType: StepUpTargetType.CERTIFICATE,
        targetId: randomUUID(),
        continuation: StepUpContinuation.CERTIFICATE_REVOKE_CONFIRMATION,
        continuationId: randomUUID(),
        expiresAt: new Date(shortLivedCreatedAt.getTime() + 5 * 60_000),
        verifiedAt: shortLivedCreatedAt,
        createdAt: shortLivedCreatedAt,
      },
    });
    const shortLivedProof = await client.stepUpProof.create({
      data: {
        challengeId: shortLivedChallenge.id,
        userId: adminUserId,
        sessionId: adminSessionId,
        proofHash: '6'.repeat(64),
        credentialEpoch,
        action: StepUpAction.CERTIFICATE_REVOKE,
        targetType: StepUpTargetType.CERTIFICATE,
        targetId: shortLivedChallenge.targetId,
        expiresAt: new Date(shortLivedCreatedAt.getTime() + 1_000),
        createdAt: shortLivedCreatedAt,
      },
    });
    await delay(1_100);
    await expect(
      client.stepUpProof.update({
        where: { id: shortLivedProof.id },
        data: { consumedAt: new Date(shortLivedCreatedAt.getTime() + 100) },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'step-up proof is immutable'),
    );
  });

  it('promotes idempotency without breaking Progress receipts and freezes success results', async () => {
    const context = await createEligibleContext('idempotency-progress');
    const progressReceipt = await client.idempotencyRecord.create({
      data: {
        actorUserId: adminUserId,
        enrollmentId: context.enrollmentId,
        key: `progress-${randomUUID()}`,
        operation: IdempotencyOperation.COMPLETE_LESSON,
        requestFingerprint: '4'.repeat(64),
        responseStatus: 200,
        responseEnvelope: { success: true },
        resultingCompletionVersion: 1,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect(progressReceipt.resultingCertificateId).toBeNull();

    const issued = await createCertificate('idempotency-certificate');
    const certificateReceipt = await client.idempotencyRecord.create({
      data: {
        actorUserId: adminUserId,
        enrollmentId: issued.enrollmentId,
        key: `certificate-${randomUUID()}`,
        operation: IdempotencyOperation.ISSUE_CERTIFICATE,
        requestFingerprint: '5'.repeat(64),
        responseStatus: 201,
        responseEnvelope: {
          success: true,
          data: { certificateId: issued.certificate.id, resultingVersion: 1 },
        },
        resultingCertificateId: issued.certificate.id,
        resultingCertificateVersion: 1,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect(certificateReceipt).toMatchObject({
      resultingCompletionVersion: null,
      resultingActivityVersion: null,
      resultingCertificateId: issued.certificate.id,
      resultingCertificateVersion: 1,
    });

    await expect(
      client.idempotencyRecord.update({
        where: { id: certificateReceipt.id },
        data: { responseStatus: 202 },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'successful idempotency receipt is immutable'),
    );

    await expect(
      client.idempotencyRecord.create({
        data: {
          actorUserId: adminUserId,
          enrollmentId: issued.enrollmentId,
          key: `invalid-certificate-${randomUUID()}`,
          operation: IdempotencyOperation.ISSUE_CERTIFICATE,
          requestFingerprint: '6'.repeat(64),
          responseStatus: 201,
          responseEnvelope: { success: true },
          resultingCompletionVersion: 1,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'idempotency_records_result_shape_check'),
    );

    await expect(
      client.idempotencyRecord.create({
        data: {
          actorUserId: adminUserId,
          enrollmentId: issued.enrollmentId,
          key: `invalid-certificate-version-${randomUUID()}`,
          operation: IdempotencyOperation.ISSUE_CERTIFICATE,
          requestFingerprint: '7'.repeat(64),
          responseStatus: 201,
          responseEnvelope: { success: true },
          resultingCertificateId: issued.certificate.id,
          resultingCertificateVersion: 2,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'idempotency_records_result_shape_check'),
    );

    const unrelatedCertificate = await createCertificate('idempotency-unrelated-certificate');
    await expect(
      client.idempotencyRecord.create({
        data: {
          actorUserId: adminUserId,
          enrollmentId: issued.enrollmentId,
          key: `mismatched-certificate-${randomUUID()}`,
          operation: IdempotencyOperation.ISSUE_CERTIFICATE,
          requestFingerprint: '8'.repeat(64),
          responseStatus: 201,
          responseEnvelope: { success: true },
          resultingCertificateId: unrelatedCertificate.certificate.id,
          resultingCertificateVersion: 1,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2003'));
  });

  it('enforces disclosure-control shape without mutating certificate evidence', async () => {
    const { certificate } = await createCertificate('disclosure');
    await expect(
      client.certificateDisclosureControl.create({
        data: {
          certificateId: certificate.id,
          recipientNameSuppressedAt: new Date(),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'certificate_disclosure_controls_shape_check'),
    );

    await expect(
      client.certificateDisclosureControl.create({
        data: {
          certificateId: certificate.id,
          recipientNameSuppressedAt: new Date(),
          suppressedByUserId: adminUserId,
          reasonCode: null,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'certificate_disclosure_controls_shape_check'),
    );

    const now = new Date();
    const control = await client.certificateDisclosureControl.create({
      data: {
        certificateId: certificate.id,
        recipientNameSuppressedAt: now,
        suppressedByUserId: adminUserId,
        reasonCode: 'PRIVACY_REQUEST',
      },
    });
    expect(control.reasonCode).toBe('PRIVACY_REQUEST');
    await expect(
      client.certificate.findUniqueOrThrow({ where: { id: certificate.id } }),
    ).resolves.toMatchObject({
      status: CertificateLifecycleStatus.ISSUED,
      recipientDisplayName: 'Learner disclosure',
    });
  });

  it('executes read-only preflight and verification SQL without mutation', async () => {
    const countsBefore = await Promise.all([
      client.certificate.count(),
      client.certificateArtifact.count(),
      client.stepUpChallenge.count(),
      client.stepUpProof.count(),
    ]);

    await executeSqlFile(preflightScriptPath, isolatedDatabaseUrl);
    await executeSqlFile(verificationScriptPath, isolatedDatabaseUrl);

    await expect(
      Promise.all([
        client.certificate.count(),
        client.certificateArtifact.count(),
        client.stepUpChallenge.count(),
        client.stepUpProof.count(),
      ]),
    ).resolves.toEqual(countsBefore);
  });

  it('refuses guarded rollback after immutable certificate evidence exists', async () => {
    await expect(executeSqlFile(rollbackScriptPath, isolatedDatabaseUrl)).rejects.toThrow(
      'Module 8.6B rollback refused: certificate lifecycle evidence exists',
    );
    await expect(client.certificate.count()).resolves.toBeGreaterThan(0);
  });

  it('rolls back only the unused Module 8.6B foundation in a clean isolated schema', async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^certificate_lifecycle_rollback_[a-f0-9]{32}$/u.test(rollbackSchemaName)) {
      throw new Error('Generated rollback schema name is invalid.');
    }
    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', rollbackSchemaName);
    const rollbackDatabaseUrl = url.toString();

    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${rollbackSchemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${rollbackSchemaName}"."citext" AS public.citext`,
    );
    await deployMigrations(rollbackDatabaseUrl);
    await executeSqlFile(rollbackScriptPath, rollbackDatabaseUrl);

    const remainingTables = await administrationClient.$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = ANY($2::TEXT[])
      `,
      rollbackSchemaName,
      [...expectedTables],
    );
    expect(remainingTables).toEqual([]);

    const idempotencyLabels = await administrationClient.$queryRawUnsafe<
      Array<{ enumlabel: string }>
    >(
      `
        SELECT pg_enum.enumlabel
        FROM pg_catalog.pg_enum
        JOIN pg_catalog.pg_type ON pg_type.oid = pg_enum.enumtypid
        JOIN pg_catalog.pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = $1
          AND pg_type.typname = 'idempotency_operation'
        ORDER BY pg_enum.enumsortorder
      `,
      rollbackSchemaName,
    );
    expect(idempotencyLabels.map(({ enumlabel }) => enumlabel)).toEqual([
      'COMPLETE_BLOCK',
      'REOPEN_BLOCK',
      'COMPLETE_LESSON',
      'REOPEN_LESSON',
      'RECORD_LAST_VISITED_LESSON',
    ]);

    const preservedTables = await administrationClient.$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name IN ('course_enrollments', 'enrollment_progress_roots')
        ORDER BY table_name
      `,
      rollbackSchemaName,
    );
    expect(preservedTables).toEqual([
      { table_name: 'course_enrollments' },
      { table_name: 'enrollment_progress_roots' },
    ]);
  }, 90_000);
});
