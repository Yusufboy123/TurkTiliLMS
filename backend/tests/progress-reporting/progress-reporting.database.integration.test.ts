import { randomUUID } from 'node:crypto';
import {
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseLevel,
  CourseStatus,
  PrismaClient,
  RoleCode,
} from '@prisma/client';
import { PrismaProgressReportingRepository } from '../../src/modules/progress-reporting/progress-reporting.repository.js';
import { ProgressReportingService } from '../../src/modules/progress-reporting/progress-reporting.service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe.sequential : describe.skip;

describeDatabase('Progress reporting PostgreSQL integration', () => {
  const client = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const suffix = randomUUID();
  const repository = new PrismaProgressReportingRepository(client);
  const service = new ProgressReportingService(repository);
  let adminId = '';
  let teacherId = '';
  let unrelatedTeacherId = '';
  let firstStudentId = '';
  let secondStudentId = '';
  let courseId = '';
  let firstEnrollmentId = '';
  let secondEnrollmentId = '';

  beforeAll(async () => {
    const [admin, teacher, unrelatedTeacher, firstStudent, secondStudent] = await Promise.all([
      client.user.create({ data: { email: `report-admin-${suffix}@example.com` } }),
      client.user.create({ data: { email: `report-teacher-${suffix}@example.com` } }),
      client.user.create({ data: { email: `report-other-teacher-${suffix}@example.com` } }),
      client.user.create({
        data: {
          email: `ali-${suffix}@example.com`,
          firstName: 'Ali',
          lastName: 'Valiyev',
          displayName: 'Ali Valiyev',
        },
      }),
      client.user.create({
        data: {
          email: `zebo-${suffix}@example.com`,
          firstName: 'Zebo',
          lastName: 'Karimova',
          displayName: 'Zebo Karimova',
        },
      }),
    ]);
    adminId = admin.id;
    teacherId = teacher.id;
    unrelatedTeacherId = unrelatedTeacher.id;
    firstStudentId = firstStudent.id;
    secondStudentId = secondStudent.id;
    const course = await client.course.create({
      data: {
        title: 'Reporting integration course',
        slug: `reporting-integration-${suffix}`,
        level: CourseLevel.A1,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: admin.id,
        teacherId: teacher.id,
      },
    });
    courseId = course.id;
    const [firstEnrollment, secondEnrollment] = await Promise.all([
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId: firstStudent.id,
          source: CourseEnrollmentSource.ADMIN,
          createdById: admin.id,
        },
      }),
      client.courseEnrollment.create({
        data: {
          courseId,
          studentId: secondStudent.id,
          source: CourseEnrollmentSource.ADMIN,
          createdById: admin.id,
          status: CourseEnrollmentStatus.COMPLETED,
          completedAt: new Date('2026-07-20T10:00:00.000Z'),
        },
      }),
    ]);
    firstEnrollmentId = firstEnrollment.id;
    secondEnrollmentId = secondEnrollment.id;
    await Promise.all([
      client.enrollmentProgressRoot.create({
        data: {
          enrollmentId: firstEnrollment.id,
          curriculumVersion: 1,
          firstActivityAt: new Date('2026-07-20T08:00:00.000Z'),
          lastVisitedAt: new Date('2026-07-21T08:00:00.000Z'),
          completedLessons: 1,
          totalEligibleLessons: 4,
          coursePercentage: 25,
        },
      }),
      client.enrollmentProgressRoot.create({
        data: {
          enrollmentId: secondEnrollment.id,
          curriculumVersion: 1,
          firstActivityAt: new Date('2026-07-18T08:00:00.000Z'),
          lastVisitedAt: new Date('2026-07-20T10:00:00.000Z'),
          completedLessons: 4,
          totalEligibleLessons: 4,
          coursePercentage: 100,
          frozenAt: new Date('2026-07-20T10:00:00.000Z'),
        },
      }),
    ]);
  });

  afterAll(async () => {
    await client.auditLog.deleteMany({
      where: { actorUserId: { in: [adminId, teacherId, unrelatedTeacherId] } },
    });
    await client.enrollmentProgressRoot.deleteMany({
      where: { enrollmentId: { in: [firstEnrollmentId, secondEnrollmentId] } },
    });
    await client.courseEnrollment.deleteMany({ where: { courseId } });
    await client.course.deleteMany({ where: { id: courseId } });
    await client.user.deleteMany({
      where: {
        id: {
          in: [adminId, teacherId, unrelatedTeacherId, firstStudentId, secondStudentId],
        },
      },
    });
    await client.$disconnect();
  });

  it('uses real PostgreSQL filtering, sorting, pagination, and aggregate projections', async () => {
    const report = await service.listTeacherCourse(
      courseId,
      {
        page: 1,
        pageSize: 1,
        search: 'Ali',
        enrollmentStatus: CourseEnrollmentStatus.ACTIVE,
        progressState: 'IN_PROGRESS',
        sortBy: 'studentName',
        sortDirection: 'asc',
      },
      {
        userId: teacherId,
        roles: [RoleCode.TEACHER],
        permissions: ['progress.course.read'],
      },
      { actorUserId: teacherId },
    );
    expect(report.items).toHaveLength(1);
    expect(report.items[0]?.student.id).toBe(firstStudentId);
    expect(report.items[0]?.percentage).toBe(25);
    expect(report.pagination).toMatchObject({ totalItems: 1, totalPages: 1 });
    expect(report).toMatchObject({
      activeEnrollmentCount: 1,
      completedEnrollmentCount: 1,
      averageProgressPercentage: 62,
    });
  });

  it('enforces teacher course isolation and admin permission on real persisted records', async () => {
    await expect(
      service.listTeacherCourse(
        courseId,
        {
          page: 1,
          pageSize: 20,
          sortBy: 'lastActivityAt',
          sortDirection: 'desc',
        },
        {
          userId: unrelatedTeacherId,
          roles: [RoleCode.TEACHER],
          permissions: ['progress.course.read'],
        },
        { actorUserId: unrelatedTeacherId },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'COURSE_SCOPE_DENIED' });

    const adminReport = await service.listAdmin(
      {
        page: 1,
        pageSize: 20,
        courseId,
        sortBy: 'percentage',
        sortDirection: 'desc',
      },
      {
        userId: adminId,
        roles: [RoleCode.ADMIN],
        permissions: ['progress.read'],
      },
      { actorUserId: adminId },
    );
    expect(adminReport.totalEnrollments).toBe(2);
    expect(adminReport.items.map((item) => item.student.id)).toEqual([
      secondStudentId,
      firstStudentId,
    ]);
  });
});
