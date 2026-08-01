import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
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
  Prisma,
  PrismaClient,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import { AdminDashboardInvariantError } from '../../src/modules/admin-dashboard/admin-dashboard.errors.js';
import {
  adminDashboardAggregateSql,
  PrismaAdminDashboardRepository,
} from '../../src/modules/admin-dashboard/admin-dashboard.repository.js';
import { AdminDashboardService } from '../../src/modules/admin-dashboard/admin-dashboard.service.js';
import type {
  AdminDashboardActor,
  AdminDashboardAggregateRow,
  AdminDashboardAuditContext,
} from '../../src/modules/admin-dashboard/admin-dashboard.types.js';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe.sequential : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');
const permissions = [
  'users.read',
  'courses.view_statistics',
  'progress.read',
  'certificates.course_read',
];

function schemaSuffix(): string {
  return randomUUID().replaceAll('-', '');
}

function utcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

function hasDatabaseConstraint(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error && error.message.includes('23514') && error.message.includes(constraint)
  );
}

describeDatabase('Admin Dashboard PostgreSQL runtime', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `admin_dashboard_test_${schemaSuffix()}`;
  let isolatedDatabaseUrl = '';
  let client: PrismaClient;
  let repository: PrismaAdminDashboardRepository;
  let service: AdminDashboardService;
  let adminId = '';
  let policyId = '';
  let templateVersionId = '';

  const actor = (): AdminDashboardActor => ({
    userId: adminId,
    roles: [RoleCode.ADMIN],
    permissions,
  });
  const audit = (): AdminDashboardAuditContext => ({
    actorUserId: adminId,
    requestCorrelationId: randomUUID(),
    ipHash: createHash('sha256').update(`integration:${adminId}`).digest('hex'),
    userAgentSummary: 'Module 9.4B integration test',
  });

  async function deployMigrations(databaseUrl: string): Promise<void> {
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      windowsHide: true,
    });
  }

  async function createCourse(
    label: string,
    status: CourseStatus,
    deleted = false,
  ): Promise<string> {
    const now = new Date('2026-08-01T08:00:00.000Z');
    const course = await client.course.create({
      data: {
        title: `Admin Dashboard ${label}`,
        slug: `admin-dashboard-${label}-${randomUUID()}`,
        status,
        createdByUserId: adminId,
        ...(status === CourseStatus.PUBLISHED ? { publishedAt: now } : {}),
        ...(status === CourseStatus.ARCHIVED ? { archivedAt: now } : {}),
        ...(deleted ? { deletedAt: now } : {}),
      },
    });
    return course.id;
  }

  async function createEnrollment(
    courseId: string,
    studentId: string,
    status: CourseEnrollmentStatus,
  ) {
    const now = new Date('2026-08-01T09:00:00.000Z');
    return client.courseEnrollment.create({
      data: {
        courseId,
        studentId,
        status,
        source: CourseEnrollmentSource.ADMIN,
        createdById: adminId,
        ...(status === CourseEnrollmentStatus.SUSPENDED ? { suspendedAt: now } : {}),
        ...(status === CourseEnrollmentStatus.COMPLETED ? { completedAt: now } : {}),
        ...(status === CourseEnrollmentStatus.CANCELLED ? { cancelledAt: now } : {}),
      },
    });
  }

  async function createCertificate(status: CertificateLifecycleStatus, label: string) {
    const student = await client.user.create({
      data: { email: `admin-dashboard-certificate-${label}-${randomUUID()}@example.com` },
    });
    const courseId = await createCourse(`certificate-${label}`, CourseStatus.PUBLISHED);
    const completedAt = new Date('2026-08-01T09:00:00.000Z');
    const enrollment = await createEnrollment(
      courseId,
      student.id,
      CourseEnrollmentStatus.COMPLETED,
    );
    await client.enrollmentProgressRoot.create({
      data: {
        enrollmentId: enrollment.id,
        completionVersion: 1,
        curriculumVersion: 1,
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
    const issuedAt = new Date('2026-08-01T10:00:00.000Z');
    const certificate = await client.certificate.create({
      data: {
        verificationTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        enrollmentId: enrollment.id,
        courseId,
        eligibilityEvaluationId: evaluation.id,
        templateVersionId,
        recipientDisplayName: `Talaba ${label}`,
        courseTitle: `Admin Dashboard certificate ${label}`,
        organizationName: 'Turk Tili LMS',
        locale: 'uz-Latn',
        issueDate: utcDate(issuedAt),
        issuedAt,
        issuedByUserId: adminId,
      },
    });
    if (status === CertificateLifecycleStatus.REVOKED) {
      return client.certificate.update({
        where: { id: certificate.id },
        data: {
          status,
          version: 2,
          revokedAt: new Date('2026-08-01T11:00:00.000Z'),
          revokedByUserId: adminId,
          revocationReasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
          revocationReasonNote: 'Integration test revocation',
        },
      });
    }
    return certificate;
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^admin_dashboard_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated database schema name is invalid.');
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
    repository = new PrismaAdminDashboardRepository(client);
    service = new AdminDashboardService(repository);

    const admin = await client.user.create({
      data: { email: `admin-dashboard-admin-${randomUUID()}@example.com` },
    });
    adminId = admin.id;
    const roleRecords = await Promise.all(
      Object.values(RoleCode).map((code) =>
        client.role.create({ data: { code, name: code, isSystem: true } }),
      ),
    );
    const byCode = new Map(roleRecords.map((role) => [role.code, role.id]));

    const [multiRole, suspended, deactivated, deleted] = await Promise.all([
      client.user.create({
        data: { email: `admin-dashboard-multi-${randomUUID()}@example.com` },
      }),
      client.user.create({
        data: {
          email: `admin-dashboard-suspended-${randomUUID()}@example.com`,
          status: UserStatus.SUSPENDED,
        },
      }),
      client.user.create({
        data: {
          email: `admin-dashboard-deactivated-${randomUUID()}@example.com`,
          status: UserStatus.DEACTIVATED,
        },
      }),
      client.user.create({
        data: {
          email: `admin-dashboard-deleted-${randomUUID()}@example.com`,
          status: UserStatus.DELETED,
          deletedAt: new Date('2026-08-01T07:00:00.000Z'),
        },
      }),
    ]);
    await client.userRole.createMany({
      data: [
        { userId: multiRole.id, roleId: byCode.get(RoleCode.STUDENT)! },
        { userId: multiRole.id, roleId: byCode.get(RoleCode.TEACHER)! },
        { userId: suspended.id, roleId: byCode.get(RoleCode.STUDENT)! },
        {
          userId: deactivated.id,
          roleId: byCode.get(RoleCode.STUDENT)!,
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
        },
        { userId: deleted.id, roleId: byCode.get(RoleCode.ADMIN)! },
      ],
    });

    const courseIds = await Promise.all([
      createCourse('draft', CourseStatus.DRAFT),
      createCourse('review', CourseStatus.IN_REVIEW),
      createCourse('published', CourseStatus.PUBLISHED),
      createCourse('archived', CourseStatus.ARCHIVED),
      createCourse('deleted', CourseStatus.PUBLISHED, true),
    ]);
    const enrollments = await Promise.all([
      createEnrollment(courseIds[0]!, multiRole.id, CourseEnrollmentStatus.ACTIVE),
      createEnrollment(courseIds[1]!, multiRole.id, CourseEnrollmentStatus.SUSPENDED),
      createEnrollment(courseIds[2]!, multiRole.id, CourseEnrollmentStatus.COMPLETED),
      createEnrollment(courseIds[3]!, multiRole.id, CourseEnrollmentStatus.CANCELLED),
    ]);
    await Promise.all(
      [12, 34, 56, 99].map((coursePercentage, index) =>
        client.enrollmentProgressRoot.create({
          data: {
            enrollmentId: enrollments[index]!.id,
            curriculumVersion: 1,
            completedLessons: coursePercentage,
            totalEligibleLessons: 100,
            coursePercentage,
            ...(index >= 2 ? { frozenAt: new Date('2026-08-01T09:00:00.000Z') } : {}),
          },
        }),
      ),
    );

    const policy = await client.certificateEligibilityPolicy.create({
      data: {
        code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
        version: 1,
        assessmentRule: CertificateEligibilityAssessmentRule.NONE,
      },
    });
    policyId = policy.id;
    const template = await client.certificateTemplate.create({
      data: { code: 'ADMIN_DASHBOARD_TEST', name: 'Admin Dashboard Test' },
    });
    const templateActivatedAt = new Date('2026-08-01T07:00:00.000Z');
    const templateVersion = await client.certificateTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        locale: 'uz-Latn',
        status: CertificateTemplateVersionStatus.ACTIVE,
        rendererContractVersion: 'certificate-pdf-v1',
        organizationDisplayName: 'Turk Tili LMS',
        organizationLegalName: 'Turk Tili LMS',
        signatoryName: 'Rahbar',
        signatoryTitle: 'Direktor',
        fontAssetId: 'noto-sans-regular-bold',
        fontAssetChecksum: 'a'.repeat(64),
        fontFamily: 'Noto Sans',
        fontVersion: '0.4.2',
        fontLicenseIdentifier: 'OFL-1.1',
        fontLicenseProvenance: 'Official locked package',
        activatedAt: templateActivatedAt,
        createdAt: new Date(templateActivatedAt.getTime() - 1),
      },
    });
    templateVersionId = templateVersion.id;
    await createCertificate(CertificateLifecycleStatus.ISSUED, 'issued');
    await createCertificate(CertificateLifecycleStatus.REVOKED, 'revoked');
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (/^admin_dashboard_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    await administrationClient.$disconnect();
  });

  it('returns exact PostgreSQL lifecycle, role, progress, and certificate aggregates', async () => {
    const result = await service.getSummary(actor(), audit());
    const [users, courses, enrollments, progress, certificates] = await Promise.all([
      client.user.count(),
      client.course.count(),
      client.courseEnrollment.count(),
      client.enrollmentProgressRoot.aggregate({
        _count: { _all: true },
        _avg: { coursePercentage: true },
      }),
      client.certificate.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    expect(result.users.total).toBe(users);
    expect(result.users).toMatchObject({ active: 4, suspended: 1, deactivated: 1, deleted: 1 });
    expect(result.users.students).toBe(2);
    expect(result.users.teachers).toBe(1);
    expect(result.users.administrators).toBe(0);
    expect(result.courses.total).toBe(courses);
    expect(result.courses).toMatchObject({
      draft: 1,
      inReview: 1,
      published: 3,
      archived: 1,
      deleted: 1,
    });
    expect(result.enrollments.total).toBe(enrollments);
    expect(result.enrollments).toMatchObject({
      active: 1,
      suspended: 1,
      completed: 3,
      cancelled: 1,
    });
    expect(result.progress.trackedEnrollments).toBe(progress._count._all);
    expect(result.progress.averageCompletionPercentage).toBe(
      Math.floor(progress._avg.coursePercentage ?? 0),
    );
    const certificateCounts = Object.fromEntries(
      certificates.map((row) => [row.status, row._count._all]),
    );
    expect(result.certificates).toEqual({
      total: 2,
      issued: certificateCounts.ISSUED,
      revoked: certificateCounts.REVOKED,
    });
  });

  it('returns zero tracked progress and zero average when PostgreSQL has no progress roots', async () => {
    const rollback = new Error('rollback zero-progress fixture');
    const originalCount = await client.enrollmentProgressRoot.count();

    await expect(
      client.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe('TRUNCATE TABLE "enrollment_progress_roots" CASCADE');
        const [aggregate] = await transaction.$queryRaw<AdminDashboardAggregateRow[]>(
          adminDashboardAggregateSql,
        );
        expect(aggregate?.progressTrackedEnrollments).toBe(0n);
        expect(aggregate?.invalidProgressCount).toBe(0n);
        expect(aggregate?.progressAverageCompletionPercentage).toBe(0n);
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    await expect(client.enrollmentProgressRoot.count()).resolves.toBe(originalCount);
  });

  it('persists only the bounded success audit atomically', async () => {
    const context = audit();
    await service.getSummary(actor(), context);
    const event = await client.auditLog.findFirstOrThrow({
      where: {
        actorUserId: adminId,
        action: 'admin_dashboard.summary_read',
        requestCorrelationId: context.requestCorrelationId!,
      },
    });
    expect(event).toMatchObject({
      subjectType: 'admin_dashboard',
      subjectId: null,
      metadata: null,
      beforeSummary: null,
      afterSummary: null,
    });
    expect(event.ipHash).toBe(context.ipHash);
    expect(event.userAgentSummary).toBe(context.userAgentSummary);
  });

  it('rolls back and returns no response when the success audit foreign key fails', async () => {
    const unknownActor = randomUUID();
    const context = { ...audit(), actorUserId: unknownActor };
    await expect(
      service.getSummary({ ...actor(), userId: unknownActor }, context),
    ).rejects.toSatisfy((error: unknown) => prismaCode(error) === 'P2003');
    await expect(
      client.auditLog.count({ where: { requestCorrelationId: context.requestCorrelationId! } }),
    ).resolves.toBe(0);
  });

  it('keeps repeated aggregate reads on one REPEATABLE READ snapshot', async () => {
    let insertedUserId = '';
    await repository.withRepeatableReadTransaction(async (transaction) => {
      const before = await transaction.readAggregate();
      const inserted = await client.user.create({
        data: { email: `admin-dashboard-concurrent-${randomUUID()}@example.com` },
      });
      insertedUserId = inserted.id;
      const after = await transaction.readAggregate();
      expect(after.usersTotal).toBe(before.usersTotal);
      expect(after.generatedAt.getTime()).toBe(before.generatedAt.getTime());
    });
    await client.user.delete({ where: { id: insertedUserId } });
  });

  it('serializes concurrent rate-limit attempts across repository instances', async () => {
    const context = audit();
    const services = Array.from(
      { length: 31 },
      () => new AdminDashboardService(new PrismaAdminDashboardRepository(client)),
    );
    const decisions = await Promise.all(
      services.map((candidate) => candidate.consumeRateLimit(actor(), context)),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(30);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(1);
    await expect(
      client.auditLog.count({
        where: {
          actorUserId: adminId,
          action: 'admin_dashboard.summary_rate_slot_consumed',
          ipHash: context.ipHash,
        },
      }),
    ).resolves.toBe(30);
  }, 30_000);

  it('supports concurrent consistent summary reads and one audit per success', async () => {
    const contexts = Array.from({ length: 5 }, () => audit());
    const results = await Promise.all(
      contexts.map((context) => service.getSummary(actor(), context)),
    );
    expect(results).toHaveLength(5);
    await expect(
      client.auditLog.count({
        where: {
          requestCorrelationId: {
            in: contexts.map((context) => context.requestCorrelationId!),
          },
          action: 'admin_dashboard.summary_read',
        },
      }),
    ).resolves.toBe(5);
  });

  it('detects both inconsistent user soft-delete directions without modifying data', async () => {
    const mismatches = await Promise.all([
      client.user.create({
        data: {
          email: `admin-dashboard-mismatch-deleted-${randomUUID()}@example.com`,
          status: UserStatus.DELETED,
        },
      }),
      client.user.create({
        data: {
          email: `admin-dashboard-mismatch-active-${randomUUID()}@example.com`,
          status: UserStatus.ACTIVE,
          deletedAt: new Date(),
        },
      }),
    ]);
    await expect(service.getSummary(actor(), audit())).rejects.toBeInstanceOf(
      AdminDashboardInvariantError,
    );
    await expect(
      client.user.count({ where: { id: { in: mismatches.map((user) => user.id) } } }),
    ).resolves.toBe(2);
    await client.user.deleteMany({ where: { id: { in: mismatches.map((user) => user.id) } } });
  });

  it('keeps invalid progress percentages out at the database constraint boundary', async () => {
    const student = await client.user.create({
      data: { email: `admin-dashboard-invalid-progress-${randomUUID()}@example.com` },
    });
    const courseId = await createCourse('invalid-progress', CourseStatus.DRAFT);
    const enrollment = await createEnrollment(
      courseId,
      student.id,
      CourseEnrollmentStatus.COMPLETED,
    );
    await expect(
      client.enrollmentProgressRoot.create({
        data: {
          enrollmentId: enrollment.id,
          curriculumVersion: 1,
          coursePercentage: 101,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      hasDatabaseConstraint(error, 'enrollment_progress_roots_percentage_check'),
    );
  });

  it('rejects a masked legacy progress percentage without inserting a success audit', async () => {
    const target = await client.enrollmentProgressRoot.findFirstOrThrow({
      where: { coursePercentage: 99 },
      select: { enrollmentId: true, coursePercentage: true },
    });
    const validRowsBefore = await client.enrollmentProgressRoot.findMany({
      orderBy: { enrollmentId: 'asc' },
      select: { enrollmentId: true, coursePercentage: true },
    });
    expect(validRowsBefore.length).toBeGreaterThan(1);
    const context = audit();

    await client.$executeRawUnsafe(`
      ALTER TABLE "enrollment_progress_roots"
      DROP CONSTRAINT "enrollment_progress_roots_percentage_check"
    `);
    try {
      await client.enrollmentProgressRoot.update({
        where: { enrollmentId: target.enrollmentId },
        data: { coursePercentage: 101 },
      });
      const [corruptAggregate] = await client.$queryRaw<AdminDashboardAggregateRow[]>(
        adminDashboardAggregateSql,
      );
      expect(corruptAggregate?.invalidProgressCount).toBe(1n);
      expect(corruptAggregate?.progressAverageCompletionPercentage).toBeGreaterThanOrEqual(0n);
      expect(corruptAggregate?.progressAverageCompletionPercentage).toBeLessThanOrEqual(100n);

      await expect(service.getSummary(actor(), context)).rejects.toBeInstanceOf(
        AdminDashboardInvariantError,
      );
      await expect(
        client.auditLog.count({
          where: {
            action: 'admin_dashboard.summary_read',
            requestCorrelationId: context.requestCorrelationId!,
          },
        }),
      ).resolves.toBe(0);
    } finally {
      await client.enrollmentProgressRoot.update({
        where: { enrollmentId: target.enrollmentId },
        data: { coursePercentage: target.coursePercentage },
      });
      await client.$executeRawUnsafe(`
        ALTER TABLE "enrollment_progress_roots"
        ADD CONSTRAINT "enrollment_progress_roots_percentage_check" CHECK (
          "course_percentage" BETWEEN 0 AND 100
          AND "course_percentage" = CASE
            WHEN "total_eligible_lessons" = 0 THEN 0
            ELSE (
              ("completed_lessons"::BIGINT * 100)
              / "total_eligible_lessons"::BIGINT
            )::INTEGER
          END
        )
      `);
    }

    await expect(
      client.enrollmentProgressRoot.findMany({
        orderBy: { enrollmentId: 'asc' },
        select: { enrollmentId: true, coursePercentage: true },
      }),
    ).resolves.toEqual(validRowsBefore);
  });

  it('produces a bounded aggregate EXPLAIN plan over the six source relations', async () => {
    const rows = await client.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>(
      Prisma.sql`EXPLAIN (FORMAT JSON) ${adminDashboardAggregateSql}`,
    );
    const plan = JSON.stringify(rows[0]?.['QUERY PLAN']);
    expect(plan.length).toBeGreaterThan(100);
    for (const relation of [
      'users',
      'user_roles',
      'courses',
      'course_enrollments',
      'enrollment_progress_roots',
      'certificates',
    ]) {
      expect(plan).toContain(relation);
    }
  });
});
