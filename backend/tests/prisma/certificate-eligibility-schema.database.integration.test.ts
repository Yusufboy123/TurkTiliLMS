import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityReasonCode,
  CertificateEligibilityStatus,
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseStatus,
  Prisma,
  PrismaClient,
  ProgressEventState,
  ProgressEventType,
} from '@prisma/client';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');
const rollbackScriptPath = resolve(
  backendRoot,
  'prisma',
  'migrations',
  '20260728120000_add_certificate_eligibility_foundation',
  'rollback.sql',
);
const certificateLifecycleRollbackScriptPath = resolve(
  backendRoot,
  'prisma',
  'migrations',
  '20260728193000_add_certificate_lifecycle_foundation',
  'rollback.sql',
);
const preflightScriptPath = resolve(
  backendRoot,
  'prisma',
  'migrations',
  '20260728120000_add_certificate_eligibility_foundation',
  'preflight.sql',
);
const verificationScriptPath = resolve(
  backendRoot,
  'prisma',
  'migrations',
  '20260728120000_add_certificate_eligibility_foundation',
  'verification.sql',
);

const expectedTables = [
  'certificate_eligibility_evaluations',
  'certificate_eligibility_policies',
  'certificate_eligibility_reasons',
] as const;

const expectedChecks = [
  'eligibility_evaluations_evaluator_check',
  'eligibility_evaluations_snapshot_check',
  'eligibility_evaluations_supersession_check',
  'eligibility_evaluations_timestamps_check',
  'eligibility_evaluations_v1_status_check',
  'eligibility_evaluations_versions_check',
  'eligibility_policies_v1_shape_check',
] as const;

const expectedIndexes = [
  'certificate_eligibility_evaluations_pkey',
  'certificate_eligibility_policies_code_version_key',
  'certificate_eligibility_policies_pkey',
  'certificate_eligibility_reasons_code_evaluation_id_idx',
  'certificate_eligibility_reasons_pkey',
  'course_enrollments_id_course_id_key',
  'eligibility_evaluations_course_status_at_idx',
  'eligibility_evaluations_enrollment_status_at_idx',
  'eligibility_evaluations_enrollment_version_key',
  'eligibility_evaluations_evaluator_at_idx',
  'eligibility_evaluations_id_enrollment_course_key',
  'eligibility_evaluations_policy_status_at_idx',
  'eligibility_evaluations_snapshot_key',
  'eligibility_evaluations_supersedes_id_key',
] as const;

const expectedForeignKeys = [
  'eligibility_evaluations_enrollment_course_fkey',
  'eligibility_evaluations_evaluated_by_fkey',
  'eligibility_evaluations_policy_id_fkey',
  'eligibility_evaluations_progress_root_fkey',
  'eligibility_evaluations_supersedes_fkey',
  'eligibility_reasons_evaluation_id_fkey',
] as const;

const expectedTriggers = [
  'certificate_eligibility_evaluations_immutable',
  'certificate_eligibility_policies_immutable',
  'certificate_eligibility_reasons_immutable',
  'certificate_eligibility_reasons_state_guard',
] as const;

function randomSchemaSuffix(): string {
  return randomUUID().replaceAll('-', '');
}

function isConstraintError(error: unknown, constraintName: string): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(constraintName) ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2004' &&
        String(error.meta?.database_error).includes(constraintName)))
  );
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function hasDatabaseMessage(error: unknown, message: string): boolean {
  return error instanceof Error && error.message.includes(message);
}

describeDatabase('Module 8.5B certificate eligibility PostgreSQL foundation', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `eligibility_schema_test_${randomSchemaSuffix()}`;
  const rollbackSchemaName = `eligibility_rollback_test_${randomSchemaSuffix()}`;
  let isolatedDatabaseUrl = '';
  let client: PrismaClient;
  let initialEvaluationCount = -1;
  let policyId = '';
  let evaluatorUserId = '';
  let courseId = '';
  let otherCourseId = '';
  let enrollmentId = '';
  let completionAt: Date;
  let evaluatedAt: Date;
  let evaluationId = '';

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^eligibility_schema_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated test schema name is invalid.');
    }

    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    isolatedDatabaseUrl = url.toString();

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
    initialEvaluationCount = await client.certificateEligibilityEvaluation.count();

    const evaluator = await client.user.create({
      data: { email: `eligibility-evaluator-${randomUUID()}@example.com` },
    });
    evaluatorUserId = evaluator.id;
    const student = await client.user.create({
      data: { email: `eligibility-student-${randomUUID()}@example.com` },
    });
    const course = await client.course.create({
      data: {
        title: 'Eligibility database foundation',
        slug: `eligibility-course-${randomUUID()}`,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: evaluator.id,
      },
    });
    courseId = course.id;
    const otherCourse = await client.course.create({
      data: {
        title: 'Unrelated eligibility course',
        slug: `eligibility-other-course-${randomUUID()}`,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: evaluator.id,
      },
    });
    otherCourseId = otherCourse.id;

    completionAt = new Date(Date.now() - 1_000);
    evaluatedAt = new Date();
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId: course.id,
        studentId: student.id,
        source: CourseEnrollmentSource.SELF,
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: completionAt,
      },
    });
    enrollmentId = enrollment.id;
    await client.enrollmentProgressRoot.create({
      data: {
        enrollmentId,
        curriculumVersion: 1,
        completionVersion: 1,
        completedEligibleBlocks: 1,
        totalEligibleBlocks: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        frozenAt: completionAt,
      },
    });
    await client.progressEvent.create({
      data: {
        enrollmentId,
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
        occurredAt: completionAt,
      },
    });

    const policy = await client.certificateEligibilityPolicy.create({
      data: {
        code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
        version: 1,
        assessmentRule: CertificateEligibilityAssessmentRule.NONE,
      },
    });
    policyId = policy.id;
    const evaluation = await client.certificateEligibilityEvaluation.create({
      data: {
        enrollmentId,
        courseId,
        policyId,
        status: CertificateEligibilityStatus.ELIGIBLE,
        evaluationVersion: 1,
        evaluatedAt,
        completedAt: completionAt,
        completionCurriculumVersion: 1,
        completionVersion: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
      },
    });
    evaluationId = evaluation.id;
  }, 60_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (/^eligibility_schema_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    if (/^eligibility_rollback_test_[a-f0-9]{32}$/u.test(rollbackSchemaName)) {
      await administrationClient.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${rollbackSchemaName}" CASCADE`,
      );
    }
    await administrationClient.$disconnect();
  });

  it('applies the approved tables, enums, checks, indexes, foreign keys, and triggers', async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY(${expectedTables})
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual([...expectedTables]);

    const enumLabels = await client.$queryRaw<
      Array<{ typname: string; enumlabel: string; enumsortorder: number }>
    >`
      SELECT pg_type.typname, pg_enum.enumlabel, pg_enum.enumsortorder
      FROM pg_catalog.pg_enum
      JOIN pg_catalog.pg_type ON pg_type.oid = pg_enum.enumtypid
      JOIN pg_catalog.pg_namespace ON pg_namespace.oid = pg_type.typnamespace
      WHERE pg_namespace.nspname = current_schema()
        AND pg_type.typname LIKE 'certificate_eligibility_%'
      ORDER BY pg_type.typname, pg_enum.enumsortorder
    `;
    expect(enumLabels.map(({ typname, enumlabel }) => ({ typname, enumlabel }))).toEqual([
      { typname: 'certificate_eligibility_assessment_rule', enumlabel: 'NONE' },
      { typname: 'certificate_eligibility_evaluator_type', enumlabel: 'SYSTEM' },
      { typname: 'certificate_eligibility_evaluator_type', enumlabel: 'USER' },
      { typname: 'certificate_eligibility_policy_code', enumlabel: 'COURSE_COMPLETION_ONLY' },
      {
        typname: 'certificate_eligibility_reason_code',
        enumlabel: 'COURSE_NOT_COMPLETED',
      },
      {
        typname: 'certificate_eligibility_reason_code',
        enumlabel: 'ZERO_ELIGIBLE_LESSONS',
      },
      {
        typname: 'certificate_eligibility_reason_code',
        enumlabel: 'COMPLETION_EVIDENCE_UNAVAILABLE',
      },
      {
        typname: 'certificate_eligibility_reason_code',
        enumlabel: 'POLICY_REQUIREMENTS_NOT_MET',
      },
      { typname: 'certificate_eligibility_status', enumlabel: 'ELIGIBLE' },
      { typname: 'certificate_eligibility_status', enumlabel: 'NOT_ELIGIBLE' },
    ]);

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

    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_catalog.pg_indexes
      WHERE schemaname = current_schema()
        AND (
          tablename LIKE 'certificate_eligibility_%'
          OR indexname = 'course_enrollments_id_course_id_key'
        )
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual([...expectedIndexes]);

    const foreignKeys = await client.$queryRaw<Array<{ conname: string; confdeltype: string }>>`
      SELECT conname, confdeltype::TEXT
      FROM pg_catalog.pg_constraint
      WHERE connamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema()
      )
        AND contype = 'f'
        AND conrelid IN (
          'certificate_eligibility_evaluations'::REGCLASS,
          'certificate_eligibility_reasons'::REGCLASS
        )
      ORDER BY conname
    `;
    expect(foreignKeys.map(({ conname }) => conname)).toEqual([...expectedForeignKeys]);
    expect(foreignKeys.every(({ confdeltype }) => confdeltype === 'r')).toBe(true);

    const triggers = await client.$queryRaw<Array<{ trigger_name: string }>>`
      SELECT DISTINCT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = current_schema()
        AND event_object_table LIKE 'certificate_eligibility_%'
      ORDER BY trigger_name
    `;
    expect(triggers.map(({ trigger_name }) => trigger_name)).toEqual([...expectedTriggers]);
  });

  it('executes read-only preflight and post-deploy verification against PostgreSQL', async () => {
    const countsBefore = await Promise.all([
      client.certificateEligibilityPolicy.count(),
      client.certificateEligibilityEvaluation.count(),
      client.certificateEligibilityReason.count(),
    ]);

    await execFileAsync(
      process.execPath,
      [prismaCliPath, 'db', 'execute', '--file', preflightScriptPath, '--url', isolatedDatabaseUrl],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
        windowsHide: true,
      },
    );
    await execFileAsync(
      process.execPath,
      [
        prismaCliPath,
        'db',
        'execute',
        '--file',
        verificationScriptPath,
        '--url',
        isolatedDatabaseUrl,
      ],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
        windowsHide: true,
      },
    );

    await expect(
      Promise.all([
        client.certificateEligibilityPolicy.count(),
        client.certificateEligibilityEvaluation.count(),
        client.certificateEligibilityReason.count(),
      ]),
    ).resolves.toEqual(countsBefore);
  }, 20_000);

  it('installs no fabricated historical policy or eligibility evidence', () => {
    expect(initialEvaluationCount).toBe(0);
  });

  it('persists one valid enrollment-scoped completion-only evaluation', async () => {
    await expect(
      client.certificateEligibilityEvaluation.findUniqueOrThrow({
        where: { id: evaluationId },
        include: {
          enrollment: { select: { id: true, courseId: true, studentId: true } },
          progressRoot: { select: { enrollmentId: true, frozenAt: true } },
          policy: { select: { code: true, version: true } },
          reasons: true,
        },
      }),
    ).resolves.toMatchObject({
      enrollmentId,
      courseId,
      status: CertificateEligibilityStatus.ELIGIBLE,
      evaluationVersion: 1,
      completionCurriculumVersion: 1,
      completionVersion: 1,
      completedLessons: 1,
      totalEligibleLessons: 1,
      coursePercentage: 100,
      evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
      evaluatedByUserId: null,
      enrollment: { id: enrollmentId, courseId },
      progressRoot: { enrollmentId, frozenAt: completionAt },
      policy: {
        code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
        version: 1,
      },
      reasons: [],
    });
  });

  it('rejects invalid v1 states, snapshots, versions, timestamps, and evaluator shapes', async () => {
    const base = {
      enrollmentId,
      courseId,
      policyId,
      evaluatedAt,
      completedAt: completionAt,
      completionCurriculumVersion: 1,
      completedLessons: 1,
      totalEligibleLessons: 1,
      coursePercentage: 100,
      evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
    } as const;

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          ...base,
          status: CertificateEligibilityStatus.NOT_ELIGIBLE,
          evaluationVersion: 10,
          completionVersion: 10,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'eligibility_evaluations_v1_status_check'),
    );

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          ...base,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 11,
          completionVersion: 11,
          coursePercentage: 99,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'eligibility_evaluations_snapshot_check'),
    );

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          ...base,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 12,
          completionVersion: 0,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'eligibility_evaluations_versions_check'),
    );

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          ...base,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 13,
          completionVersion: 13,
          evaluatedAt: new Date(completionAt.getTime() - 1),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'eligibility_evaluations_timestamps_check'),
    );

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          ...base,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 14,
          completionVersion: 14,
          evaluatorType: CertificateEligibilityEvaluatorType.USER,
          evaluatedByUserId: null,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'eligibility_evaluations_evaluator_check'),
    );
  });

  it('enforces evaluation version and canonical snapshot uniqueness', async () => {
    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          enrollmentId,
          courseId,
          policyId,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 2,
          evaluatedAt,
          completedAt: completionAt,
          completionCurriculumVersion: 1,
          completionVersion: 1,
          completedLessons: 1,
          totalEligibleLessons: 1,
          coursePercentage: 100,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          enrollmentId,
          courseId,
          policyId,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 1,
          evaluatedAt,
          completedAt: completionAt,
          completionCurriculumVersion: 1,
          completionVersion: 2,
          completedLessons: 1,
          totalEligibleLessons: 1,
          coursePercentage: 100,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));
  });

  it('enforces trusted enrollment-course and progress-root relationships', async () => {
    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          enrollmentId,
          courseId: otherCourseId,
          policyId,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 20,
          evaluatedAt,
          completedAt: completionAt,
          completionCurriculumVersion: 1,
          completionVersion: 20,
          completedLessons: 1,
          totalEligibleLessons: 1,
          coursePercentage: 100,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2003'));

    await expect(
      client.certificateEligibilityEvaluation.create({
        data: {
          enrollmentId: randomUUID(),
          courseId,
          policyId,
          status: CertificateEligibilityStatus.ELIGIBLE,
          evaluationVersion: 21,
          evaluatedAt,
          completedAt: completionAt,
          completionCurriculumVersion: 1,
          completionVersion: 21,
          completedLessons: 1,
          totalEligibleLessons: 1,
          coursePercentage: 100,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2003'));
  });

  it('keeps policy and evidence immutable and rejects reasons for ELIGIBLE evidence', async () => {
    await expect(
      client.certificateEligibilityPolicy.update({
        where: { id: policyId },
        data: { requiresAttendance: true },
      }),
    ).rejects.toSatisfy((error: unknown) => hasDatabaseMessage(error, 'is immutable'));

    await expect(
      client.certificateEligibilityEvaluation.update({
        where: { id: evaluationId },
        data: { evaluatedByUserId: evaluatorUserId },
      }),
    ).rejects.toSatisfy((error: unknown) => hasDatabaseMessage(error, 'is immutable'));

    await expect(
      client.certificateEligibilityEvaluation.delete({ where: { id: evaluationId } }),
    ).rejects.toSatisfy((error: unknown) => hasDatabaseMessage(error, 'is immutable'));

    await expect(
      client.certificateEligibilityReason.create({
        data: {
          evaluationId,
          code: CertificateEligibilityReasonCode.COURSE_NOT_COMPLETED,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseMessage(error, 'ELIGIBLE evidence cannot contain reason codes'),
    );
  });

  it('excludes completion events with contradictory block counters from backfill candidates', async () => {
    const student = await client.user.create({
      data: { email: `eligibility-preflight-${randomUUID()}@example.com` },
    });
    const mismatchCompletionAt = new Date(Date.now() - 2_000);
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId,
        studentId: student.id,
        source: CourseEnrollmentSource.SELF,
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: mismatchCompletionAt,
      },
    });
    await client.enrollmentProgressRoot.create({
      data: {
        enrollmentId: enrollment.id,
        curriculumVersion: 1,
        completionVersion: 1,
        completedEligibleBlocks: 2,
        totalEligibleBlocks: 2,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        frozenAt: mismatchCompletionAt,
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
        snapshotTotalEligibleBlocks: 2,
        snapshotCompletedLessons: 1,
        snapshotTotalEligibleLessons: 1,
        snapshotCoursePercentage: 100,
        occurredAt: mismatchCompletionAt,
      },
    });

    const preflightSql = await readFile(preflightScriptPath, 'utf8');
    const candidateQueryStart = preflightSql.lastIndexOf(
      'SELECT COUNT(*) AS deterministic_backfill_candidate_count',
    );
    const candidateQueryEnd = preflightSql.indexOf('\n\nROLLBACK;', candidateQueryStart);
    expect(candidateQueryStart).toBeGreaterThanOrEqual(0);
    expect(candidateQueryEnd).toBeGreaterThan(candidateQueryStart);

    const candidateQuery = preflightSql.slice(candidateQueryStart, candidateQueryEnd);
    const candidates =
      await client.$queryRawUnsafe<Array<{ deterministic_backfill_candidate_count: bigint }>>(
        candidateQuery,
      );

    expect(candidates).toEqual([{ deterministic_backfill_candidate_count: 1n }]);
  });

  it('refuses the rollback aid when immutable eligibility evidence exists', async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          prismaCliPath,
          'db',
          'execute',
          '--file',
          rollbackScriptPath,
          '--url',
          isolatedDatabaseUrl,
        ],
        {
          cwd: backendRoot,
          env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
          windowsHide: true,
        },
      ),
    ).rejects.toThrow('Module 8.5B rollback refused: certificate eligibility evidence exists');

    await expect(
      client.certificateEligibilityEvaluation.findUniqueOrThrow({
        where: { id: evaluationId },
      }),
    ).resolves.toMatchObject({ id: evaluationId });
  });

  it('rolls back only Module 8.5B objects in a clean isolated schema', async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^eligibility_rollback_test_[a-f0-9]{32}$/u.test(rollbackSchemaName)) {
      throw new Error('Generated rollback test schema name is invalid.');
    }

    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', rollbackSchemaName);
    const rollbackDatabaseUrl = url.toString();

    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${rollbackSchemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${rollbackSchemaName}"."citext" AS public.citext`,
    );
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: rollbackDatabaseUrl },
      windowsHide: true,
    });

    // Reverse later additive dependencies before testing the Module 8.5B aid.
    await execFileAsync(
      process.execPath,
      [
        prismaCliPath,
        'db',
        'execute',
        '--file',
        certificateLifecycleRollbackScriptPath,
        '--url',
        rollbackDatabaseUrl,
      ],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: rollbackDatabaseUrl },
        windowsHide: true,
      },
    );

    await execFileAsync(
      process.execPath,
      [prismaCliPath, 'db', 'execute', '--file', rollbackScriptPath, '--url', rollbackDatabaseUrl],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: rollbackDatabaseUrl },
        windowsHide: true,
      },
    );

    const remainingEligibilityTables = await administrationClient.$queryRawUnsafe<
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
    expect(remainingEligibilityTables).toEqual([]);

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

    const compositeIndex = await administrationClient.$queryRawUnsafe<Array<{ indexname: string }>>(
      `
        SELECT indexname
        FROM pg_catalog.pg_indexes
        WHERE schemaname = $1
          AND indexname = 'course_enrollments_id_course_id_key'
      `,
      rollbackSchemaName,
    );
    expect(compositeIndex).toEqual([]);
  }, 20_000);
});
