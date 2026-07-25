import { randomUUID } from 'node:crypto';
import {
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseLevel,
  CourseStatus,
  Prisma,
  PrismaClient,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import { PrismaCourseEnrollmentRepository } from '../../src/modules/course-enrollments/course-enrollment.repository.js';
import { CourseEnrollmentService } from '../../src/modules/course-enrollments/course-enrollment.service.js';
import { AppError } from '../../src/utils/app-error.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function expectAppError(error: unknown, code: string, statusCode: number): boolean {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode });
  return true;
}

function isDatabaseConstraintError(error: unknown, constraintName: string): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(constraintName) ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2004'))
  );
}

describeDatabase('Course enrollment PostgreSQL integration', () => {
  const client = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const concurrentClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const suffix = randomUUID();
  let adminId = '';
  let teacherId = '';
  let studentId = '';
  let studentRoleId = '';
  let courseId = '';

  const service = new CourseEnrollmentService(new PrismaCourseEnrollmentRepository(client));
  const studentActor = () => ({
    userId: studentId,
    roles: [RoleCode.STUDENT],
    permissions: ['enrollments.self_create', 'enrollments.self_read', 'enrollments.self_cancel'],
  });
  const adminActor = () => ({
    userId: adminId,
    roles: [RoleCode.ADMIN],
    permissions: ['enrollments.create', 'enrollments.read', 'enrollments.update_status'],
  });
  const teacherActor = () => ({
    userId: teacherId,
    roles: [RoleCode.TEACHER],
    permissions: ['enrollments.create', 'enrollments.read', 'enrollments.update_status'],
  });

  beforeAll(async () => {
    const studentRole = await client.role.upsert({
      where: { code: RoleCode.STUDENT },
      update: {},
      create: {
        code: RoleCode.STUDENT,
        name: 'Student',
        isSystem: true,
      },
    });
    studentRoleId = studentRole.id;
    const admin = await client.user.create({
      data: {
        email: `enrollment-admin-${suffix}@example.com`,
        firstName: 'Admin',
      },
    });
    adminId = admin.id;
    const teacher = await client.user.create({
      data: {
        email: `enrollment-teacher-${suffix}@example.com`,
        firstName: 'Teacher',
      },
    });
    teacherId = teacher.id;
    const student = await client.user.create({
      data: {
        email: `enrollment-student-${suffix}@example.com`,
        firstName: 'Student',
        roles: {
          create: {
            roleId: studentRole.id,
            assignedByUserId: admin.id,
          },
        },
      },
    });
    studentId = student.id;
    const course = await client.course.create({
      data: {
        title: 'Enrollment integration course',
        slug: `enrollment-integration-${suffix}`,
        description: 'Published test course',
        level: CourseLevel.A1,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: admin.id,
        teacherId: teacher.id,
      },
    });
    courseId = course.id;
  });

  afterEach(async () => {
    await client.auditLog.deleteMany({
      where: {
        subjectType: 'course_enrollment',
        actorUserId: { in: [studentId, adminId, teacherId] },
      },
    });
    await client.courseEnrollment.deleteMany({ where: { courseId } });
    await client.course.update({
      where: { id: courseId },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        deletedAt: null,
        teacherId,
      },
    });
    await client.user.update({
      where: { id: studentId },
      data: { status: UserStatus.ACTIVE, deletedAt: null },
    });
    await client.userRole.upsert({
      where: { userId_roleId: { userId: studentId, roleId: studentRoleId } },
      update: { expiresAt: null, assignedByUserId: adminId },
      create: { userId: studentId, roleId: studentRoleId, assignedByUserId: adminId },
    });
  });

  afterAll(async () => {
    await client.auditLog.deleteMany({
      where: { actorUserId: { in: [studentId, adminId, teacherId] } },
    });
    await client.courseEnrollment.deleteMany({ where: { courseId } });
    await client.course.deleteMany({ where: { id: courseId } });
    await client.userRole.deleteMany({ where: { userId: studentId, roleId: studentRoleId } });
    await client.user.deleteMany({ where: { id: { in: [studentId, teacherId, adminId] } } });
    await Promise.all([client.$disconnect(), concurrentClient.$disconnect()]);
  });

  async function createAndSuspend(): Promise<string> {
    const enrollment = await service.selfEnroll(courseId, studentActor(), {
      actorUserId: studentId,
    });
    const suspended = await service.updateStatus(
      enrollment.id,
      CourseEnrollmentStatus.SUSPENDED,
      adminActor(),
      { actorUserId: adminId },
    );
    return suspended.id;
  }

  async function mutateWhileEnrollmentStarts(
    mutation: (transaction: Prisma.TransactionClient) => Promise<void>,
  ): Promise<PromiseSettledResult<unknown>> {
    const mutationReady = deferred();
    const releaseMutation = deferred();
    const mutationPromise = concurrentClient.$transaction(async (transaction) => {
      await mutation(transaction);
      mutationReady.resolve();
      await releaseMutation.promise;
    });
    await mutationReady.promise;
    const enrollmentPromise = service.selfEnroll(courseId, studentActor(), {
      actorUserId: studentId,
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    releaseMutation.resolve();
    await mutationPromise;
    const [result] = await Promise.allSettled([enrollmentPromise]);
    if (!result) throw new Error('Enrollment result was not collected.');
    return result;
  }

  it('allows exactly one ACTIVE membership under concurrent self-enrollment', async () => {
    const attempts = await Promise.allSettled([
      service.selfEnroll(courseId, studentActor(), { actorUserId: studentId }),
      service.selfEnroll(courseId, studentActor(), { actorUserId: studentId }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find(
      (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected',
    );
    expectAppError(rejected?.reason, 'ALREADY_ENROLLED', 409);
    await expect(
      client.courseEnrollment.count({
        where: {
          courseId,
          studentId,
          status: CourseEnrollmentStatus.ACTIVE,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      client.auditLog.count({
        where: {
          subjectType: 'course_enrollment',
          actorUserId: studentId,
          action: 'course_enrollments.created',
        },
      }),
    ).resolves.toBe(1);
  });

  it('rejects creation when the course is concurrently unpublished before eligibility locks', async () => {
    const result = await mutateWhileEnrollmentStarts(async (transaction) => {
      await transaction.course.update({
        where: { id: courseId },
        data: { status: CourseStatus.DRAFT, publishedAt: null },
      });
    });
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expectAppError(result.reason, 'COURSE_NOT_ENROLLABLE', 409);
    }
    await expect(client.courseEnrollment.count({ where: { courseId } })).resolves.toBe(0);
  });

  it('rejects teacher-managed creation when course ownership changes concurrently', async () => {
    const mutationReady = deferred();
    const releaseMutation = deferred();
    const mutationPromise = concurrentClient.$transaction(async (transaction) => {
      await transaction.course.update({
        where: { id: courseId },
        data: { teacherId: null },
      });
      mutationReady.resolve();
      await releaseMutation.promise;
    });
    await mutationReady.promise;
    const enrollmentPromise = service.createManaged(courseId, studentId, teacherActor(), {
      actorUserId: teacherId,
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    releaseMutation.resolve();
    await mutationPromise;

    await expect(enrollmentPromise).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'COURSE_SCOPE_DENIED', 403),
    );
    await expect(client.courseEnrollment.count({ where: { courseId } })).resolves.toBe(0);
  });

  it('rejects creation when the student is concurrently deactivated', async () => {
    const result = await mutateWhileEnrollmentStarts(async (transaction) => {
      await transaction.user.update({
        where: { id: studentId },
        data: { status: UserStatus.DEACTIVATED },
      });
    });
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expectAppError(result.reason, 'STUDENT_NOT_ELIGIBLE', 422);
    }
    await expect(client.courseEnrollment.count({ where: { courseId } })).resolves.toBe(0);
  });

  it('rejects creation when the STUDENT role is concurrently removed', async () => {
    const result = await mutateWhileEnrollmentStarts(async (transaction) => {
      await transaction.userRole.delete({
        where: { userId_roleId: { userId: studentId, roleId: studentRoleId } },
      });
    });
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expectAppError(result.reason, 'STUDENT_NOT_ELIGIBLE', 422);
    }
    await expect(client.courseEnrollment.count({ where: { courseId } })).resolves.toBe(0);
  });

  it('rejects creation when the STUDENT role concurrently expires', async () => {
    const result = await mutateWhileEnrollmentStarts(async (transaction) => {
      await transaction.userRole.update({
        where: { userId_roleId: { userId: studentId, roleId: studentRoleId } },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    });
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expectAppError(result.reason, 'STUDENT_NOT_ELIGIBLE', 422);
    }
  });

  it('rejects SUSPENDED to ACTIVE after course unpublication', async () => {
    const enrollmentId = await createAndSuspend();
    await client.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.DRAFT, publishedAt: null },
    });
    await expect(
      service.updateStatus(enrollmentId, CourseEnrollmentStatus.ACTIVE, adminActor(), {
        actorUserId: adminId,
      }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'COURSE_NOT_ENROLLABLE', 409));
    await expect(
      client.courseEnrollment.findUnique({
        where: { id: enrollmentId },
        select: { status: true },
      }),
    ).resolves.toMatchObject({ status: CourseEnrollmentStatus.SUSPENDED });
  });

  it('rejects SUSPENDED to ACTIVE after student deactivation', async () => {
    const enrollmentId = await createAndSuspend();
    await client.user.update({
      where: { id: studentId },
      data: { status: UserStatus.DEACTIVATED },
    });
    await expect(
      service.updateStatus(enrollmentId, CourseEnrollmentStatus.ACTIVE, adminActor(), {
        actorUserId: adminId,
      }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'STUDENT_NOT_ELIGIBLE', 422));
  });

  it.each([
    ['removed', null],
    ['expired', new Date(Date.now() - 60_000)],
  ] as const)(
    'rejects SUSPENDED to ACTIVE after the STUDENT role is %s',
    async (_label, expiry) => {
      const enrollmentId = await createAndSuspend();
      if (expiry) {
        await client.userRole.update({
          where: { userId_roleId: { userId: studentId, roleId: studentRoleId } },
          data: { expiresAt: expiry },
        });
      } else {
        await client.userRole.delete({
          where: { userId_roleId: { userId: studentId, roleId: studentRoleId } },
        });
      }
      await expect(
        service.updateStatus(enrollmentId, CourseEnrollmentStatus.ACTIVE, adminActor(), {
          actorUserId: adminId,
        }),
      ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'STUDENT_NOT_ELIGIBLE', 422));
    },
  );

  it('allows only one of two concurrent status transitions to commit', async () => {
    const enrollment = await service.selfEnroll(courseId, studentActor(), {
      actorUserId: studentId,
    });
    const attempts = await Promise.allSettled([
      service.updateStatus(enrollment.id, CourseEnrollmentStatus.SUSPENDED, adminActor(), {
        actorUserId: adminId,
      }),
      service.updateStatus(enrollment.id, CourseEnrollmentStatus.COMPLETED, adminActor(), {
        actorUserId: adminId,
      }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find(
      (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected',
    );
    expect(rejected?.reason).toBeInstanceOf(AppError);
    expect(['INVALID_ENROLLMENT_STATUS_TRANSITION', 'ENROLLMENT_CONFLICT']).toContain(
      (rejected?.reason as AppError).code,
    );
    await expect(
      client.auditLog.count({
        where: {
          subjectType: 'course_enrollment',
          subjectId: enrollment.id,
          action: {
            in: ['course_enrollments.suspended', 'course_enrollments.completed'],
          },
        },
      }),
    ).resolves.toBe(1);
  });

  it('preserves cancelled history and supports an explicit re-enrollment', async () => {
    const first = await service.selfEnroll(courseId, studentActor(), { actorUserId: studentId });
    await service.cancelOwn(first.id, studentActor(), { actorUserId: studentId });
    const second = await service.selfEnroll(courseId, studentActor(), { actorUserId: studentId });
    expect(second.id).not.toBe(first.id);
    const records = await client.courseEnrollment.findMany({
      where: { courseId, studentId },
      orderBy: { enrolledAt: 'asc' },
      select: { status: true },
    });
    expect(records.map((record) => record.status).sort()).toEqual([
      CourseEnrollmentStatus.ACTIVE,
      CourseEnrollmentStatus.CANCELLED,
    ]);
  });

  it('enforces current-membership uniqueness for direct ACTIVE and SUSPENDED combinations', async () => {
    const active = await client.courseEnrollment.create({
      data: {
        courseId,
        studentId,
        source: CourseEnrollmentSource.SELF,
      },
    });
    await expect(
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId,
          status: CourseEnrollmentStatus.SUSPENDED,
          suspendedAt: new Date(),
          source: CourseEnrollmentSource.SELF,
        },
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002',
    );

    await client.courseEnrollment.delete({ where: { id: active.id } });
    await client.courseEnrollment.create({
      data: {
        courseId,
        studentId,
        status: CourseEnrollmentStatus.SUSPENDED,
        suspendedAt: new Date(),
        source: CourseEnrollmentSource.SELF,
      },
    });
    await expect(
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId,
          source: CourseEnrollmentSource.SELF,
        },
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002',
    );
  });

  it('enforces lifecycle and source/creator CHECK constraints in PostgreSQL', async () => {
    await expect(
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId,
          status: CourseEnrollmentStatus.ACTIVE,
          suspendedAt: new Date(),
          source: CourseEnrollmentSource.SELF,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isDatabaseConstraintError(error, 'course_enrollments_lifecycle_timestamps_check'),
    );

    await expect(
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId,
          source: CourseEnrollmentSource.SELF,
          createdById: adminId,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isDatabaseConstraintError(error, 'course_enrollments_source_creator_check'),
    );

    await expect(
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId,
          source: CourseEnrollmentSource.ADMIN,
          createdById: null,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isDatabaseConstraintError(error, 'course_enrollments_source_creator_check'),
    );
  });

  it('restricts deleting referenced course and student records', async () => {
    await client.courseEnrollment.create({
      data: {
        courseId,
        studentId,
        source: CourseEnrollmentSource.SELF,
      },
    });
    await expect(client.course.delete({ where: { id: courseId } })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003',
    );
    await expect(client.user.delete({ where: { id: studentId } })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003',
    );
  });
});
