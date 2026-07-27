import { randomUUID } from 'node:crypto';
import {
  BlockProgressState,
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseLevel,
  CourseStatus,
  LessonContentBlockType,
  LessonStatus,
  LessonType,
  PrismaClient,
  ProgressEventType,
  RoleCode,
} from '@prisma/client';
import { PrismaCourseEnrollmentRepository } from '../../src/modules/course-enrollments/course-enrollment.repository.js';
import { CourseEnrollmentService } from '../../src/modules/course-enrollments/course-enrollment.service.js';
import { PrismaLessonContentBlockRepository } from '../../src/modules/lesson-content-blocks/lesson-content-block.repository.js';
import { PrismaLessonManagementRepository } from '../../src/modules/lessons/lesson-management.repository.js';
import { PrismaProgressTrackingRepository } from '../../src/modules/progress-tracking/progress-tracking.repository.js';
import { ProgressTrackingService } from '../../src/modules/progress-tracking/progress-tracking.service.js';
import { AppError } from '../../src/utils/app-error.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe.sequential : describe.skip;

function expectAppError(error: unknown, code: string, statusCode: number): boolean {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode });
  return true;
}

describeDatabase('Progress tracking PostgreSQL integration', () => {
  const client = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const concurrentClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const suffix = randomUUID();
  let studentId = '';
  let adminId = '';
  let courseId = '';
  let sectionId = '';
  let lessonId = '';
  let secondLessonId = '';
  let blockId = '';
  let enrollmentId = '';

  const service = new ProgressTrackingService(new PrismaProgressTrackingRepository(client));
  const actor = () => ({
    userId: studentId,
    roles: [RoleCode.STUDENT],
    permissions: [
      'progress.self_read',
      'progress.self_complete',
      'progress.self_reopen',
      'progress.self_record_visit',
    ],
  });

  beforeAll(async () => {
    const studentRole = await client.role.upsert({
      where: { code: RoleCode.STUDENT },
      update: {},
      create: { code: RoleCode.STUDENT, name: 'Student', isSystem: true },
    });
    const admin = await client.user.create({
      data: { email: `progress-admin-${suffix}@example.com`, firstName: 'Admin' },
    });
    adminId = admin.id;
    const student = await client.user.create({
      data: {
        email: `progress-student-${suffix}@example.com`,
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
        title: 'Progress integration course',
        slug: `progress-integration-${suffix}`,
        level: CourseLevel.A1,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: admin.id,
      },
    });
    courseId = course.id;
    const section = await client.courseSection.create({
      data: {
        courseId,
        title: 'Progress section',
        position: 1,
        isPublished: true,
        createdById: admin.id,
      },
    });
    sectionId = section.id;
    const lesson = await client.lesson.create({
      data: {
        courseId,
        sectionId,
        title: 'Progress lesson',
        slug: `progress-lesson-${suffix}`,
        lessonType: LessonType.TEXT,
        position: 1,
        status: LessonStatus.PUBLISHED,
        publishedAt: new Date(),
        createdById: admin.id,
      },
    });
    lessonId = lesson.id;
    const secondLesson = await client.lesson.create({
      data: {
        courseId,
        sectionId,
        title: 'Progress lesson two',
        slug: `progress-lesson-two-${suffix}`,
        lessonType: LessonType.TEXT,
        position: 2,
        status: LessonStatus.PUBLISHED,
        publishedAt: new Date(),
        createdById: admin.id,
      },
    });
    secondLessonId = secondLesson.id;
    const block = await client.lessonContentBlock.create({
      data: {
        lessonId,
        blockType: LessonContentBlockType.TEXT,
        textContent: 'Progress integration content',
        title: 'Required block',
        position: 1,
        isRequired: true,
        isVisible: true,
        createdById: admin.id,
      },
    });
    blockId = block.id;
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId,
        studentId,
        source: CourseEnrollmentSource.SELF,
      },
    });
    enrollmentId = enrollment.id;
  });

  beforeEach(async () => {
    await client.progressEvent.deleteMany({ where: { enrollmentId } });
    await client.idempotencyRecord.deleteMany({ where: { enrollmentId } });
    await client.blockProgress.deleteMany({ where: { enrollmentId } });
    await client.lessonProgress.deleteMany({ where: { enrollmentId } });
    await client.enrollmentProgressRoot.deleteMany({ where: { enrollmentId } });
    await client.courseEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: CourseEnrollmentStatus.ACTIVE,
        completedAt: null,
        cancelledAt: null,
        suspendedAt: null,
      },
    });
    await client.course.update({
      where: { id: courseId },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        deletedAt: null,
        curriculumVersion: 1,
      },
    });
    await client.courseSection.update({
      where: { id: sectionId },
      data: { isPublished: true, deletedAt: null, position: 1 },
    });
    await client.lesson.update({
      where: { id: lessonId },
      data: {
        status: LessonStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
        position: 1,
      },
    });
    await client.lesson.update({
      where: { id: secondLessonId },
      data: {
        status: LessonStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
        position: 2,
      },
    });
    await client.lessonContentBlock.update({
      where: { id: blockId },
      data: { isVisible: true, isRequired: true, deletedAt: null, position: 1 },
    });
  });

  afterAll(async () => {
    await client.progressEvent.deleteMany({ where: { enrollmentId } });
    await client.idempotencyRecord.deleteMany({ where: { enrollmentId } });
    await client.blockProgress.deleteMany({ where: { enrollmentId } });
    await client.lessonProgress.deleteMany({ where: { enrollmentId } });
    await client.enrollmentProgressRoot.deleteMany({ where: { enrollmentId } });
    await client.courseEnrollment.deleteMany({ where: { id: enrollmentId } });
    await client.lessonContentBlock.deleteMany({ where: { lessonId } });
    await client.lesson.deleteMany({ where: { courseId } });
    await client.courseSection.deleteMany({ where: { courseId } });
    await client.course.deleteMany({ where: { id: courseId } });
    await client.userRole.deleteMany({ where: { userId: studentId } });
    await client.user.deleteMany({ where: { id: { in: [studentId, adminId] } } });
    await Promise.all([client.$disconnect(), concurrentClient.$disconnect()]);
  });

  it('persists activity separately from completion state', async () => {
    const result = await service.recordLastVisitedLesson(
      enrollmentId,
      { lessonId, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );

    expect(result.envelope.data).toMatchObject({
      completionVersion: 0,
      activityVersion: 1,
      lastVisitedLessonId: lessonId,
    });
    await expect(client.progressEvent.count({ where: { enrollmentId } })).resolves.toBe(0);
    await expect(
      client.lessonProgress.findUniqueOrThrow({
        where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      }),
    ).resolves.toMatchObject({ state: 'IN_PROGRESS' });
  });

  it('returns database-backed summary and enrollment progress read models', async () => {
    await service.recordLastVisitedLesson(
      enrollmentId,
      { lessonId, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );

    const summary = await service.getOwnSummary(5, actor());
    const detail = await service.getOwnEnrollmentProgress(enrollmentId, actor());

    expect(summary).toMatchObject({
      activeCourseCount: 1,
      completedCourseCount: 0,
    });
    expect(summary.activeCourses).toHaveLength(1);
    expect(summary.activeCourses[0]).toMatchObject({
      enrollmentId,
      course: { id: courseId },
      resumeTarget: { lesson: { id: lessonId } },
    });
    expect(detail).toMatchObject({
      enrollmentId,
      course: { id: courseId },
      curriculumVersion: 1,
      activityVersion: 1,
      resumeTarget: { lesson: { id: lessonId } },
    });
    expect(detail.sections).toHaveLength(1);
    expect(detail.sections[0]?.lessons).toHaveLength(2);
  });

  it('persists sparse block transitions and fixed-column events', async () => {
    await service.completeBlock(
      enrollmentId,
      blockId,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );
    await service.reopenBlock(
      enrollmentId,
      blockId,
      { expectedCompletionVersion: 1, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );

    await expect(
      client.blockProgress.findUniqueOrThrow({
        where: { enrollmentId_blockId: { enrollmentId, blockId } },
      }),
    ).resolves.toMatchObject({ state: BlockProgressState.INCOMPLETE, completedAt: null });
    const events = await client.progressEvent.findMany({
      where: { enrollmentId },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      ProgressEventType.BLOCK_COMPLETED,
      ProgressEventType.BLOCK_REOPENED,
    ]);
  });

  it('atomically completes the final lesson, enrollment, root, and terminal event', async () => {
    await service.completeBlock(
      enrollmentId,
      blockId,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );
    await service.completeLesson(
      enrollmentId,
      lessonId,
      { expectedCompletionVersion: 1, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );
    const completed = await service.completeLesson(
      enrollmentId,
      secondLessonId,
      { expectedCompletionVersion: 2, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );

    expect(completed.envelope.data.course).toMatchObject({
      enrollmentStatus: CourseEnrollmentStatus.COMPLETED,
      percentage: 100,
      completedLessons: 2,
      totalEligibleLessons: 2,
    });
    await expect(
      client.courseEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } }),
    ).resolves.toMatchObject({ status: CourseEnrollmentStatus.COMPLETED });
    await expect(
      client.enrollmentProgressRoot.findUniqueOrThrow({ where: { enrollmentId } }),
    ).resolves.toMatchObject({
      completionVersion: 3,
      completedLessons: 2,
      totalEligibleLessons: 2,
      coursePercentage: 100,
    });
    await expect(
      client.progressEvent.count({
        where: { enrollmentId, eventType: ProgressEventType.COURSE_COMPLETED },
      }),
    ).resolves.toBe(1);

    const completedCourses = await service.listOwnCompleted(
      { page: 1, pageSize: 20, sortBy: 'completedAt', sortDirection: 'desc' },
      actor(),
    );
    expect(completedCourses.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
    expect(completedCourses.items).toHaveLength(1);
    expect(completedCourses.items[0]).toMatchObject({
      enrollmentId,
      course: { id: courseId },
      percentage: 100,
    });
  });

  it('replays one committed response without duplicating state or events', async () => {
    const key = randomUUID();
    const input = { expectedCompletionVersion: 0, curriculumVersion: 1 };
    const first = await service.completeBlock(enrollmentId, blockId, input, actor(), {
      idempotencyKey: key,
    });
    const replay = await service.completeBlock(enrollmentId, blockId, input, actor(), {
      idempotencyKey: key,
    });

    expect(replay).toEqual({ envelope: first.envelope, replayed: true });
    await expect(client.idempotencyRecord.count({ where: { enrollmentId } })).resolves.toBe(1);
    await expect(client.progressEvent.count({ where: { enrollmentId } })).resolves.toBe(1);
  });

  it('rolls back root, child state, event, and idempotency on a stale curriculum', async () => {
    await expect(
      service.completeBlock(
        enrollmentId,
        blockId,
        { expectedCompletionVersion: 0, curriculumVersion: 2 },
        actor(),
        { idempotencyKey: randomUUID() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'CURRICULUM_VERSION_CONFLICT', 409),
    );

    await expect(client.enrollmentProgressRoot.count({ where: { enrollmentId } })).resolves.toBe(0);
    await expect(client.blockProgress.count({ where: { enrollmentId } })).resolves.toBe(0);
    await expect(client.progressEvent.count({ where: { enrollmentId } })).resolves.toBe(0);
    await expect(client.idempotencyRecord.count({ where: { enrollmentId } })).resolves.toBe(0);
  });

  it('allows one winner for concurrent completion with different keys and one expected version', async () => {
    const concurrentService = new ProgressTrackingService(
      new PrismaProgressTrackingRepository(concurrentClient),
    );
    const attempts = await Promise.allSettled([
      service.completeBlock(
        enrollmentId,
        blockId,
        { expectedCompletionVersion: 0, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: randomUUID() },
      ),
      concurrentService.completeBlock(
        enrollmentId,
        blockId,
        { expectedCompletionVersion: 0, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: randomUUID() },
      ),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find(
      (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected',
    );
    expectAppError(rejected?.reason, 'COMPLETION_VERSION_CONFLICT', 409);
    await expect(client.blockProgress.count({ where: { enrollmentId } })).resolves.toBe(1);
    await expect(client.progressEvent.count({ where: { enrollmentId } })).resolves.toBe(1);
  });

  it('reconciles a new curriculum version before returning authoritative progress', async () => {
    await service.getOwnEnrollmentProgress(enrollmentId, actor());
    await client.course.update({
      where: { id: courseId },
      data: { curriculumVersion: { increment: 1 } },
    });

    const progress = await service.getOwnEnrollmentProgress(enrollmentId, actor());

    expect(progress.curriculumVersion).toBe(2);
    expect(progress.completionVersion).toBe(0);
    await expect(
      client.enrollmentProgressRoot.findUniqueOrThrow({ where: { enrollmentId } }),
    ).resolves.toMatchObject({ curriculumVersion: 2 });
  });

  it('bumps curriculum version atomically when block visibility changes', async () => {
    const blocks = new PrismaLessonContentBlockRepository(client);
    await blocks.updateVisibility(lessonId, blockId, false, {
      actorUserId: adminId,
      courseId,
    });

    await expect(
      client.course.findUniqueOrThrow({ where: { id: courseId } }),
    ).resolves.toMatchObject({
      curriculumVersion: 2,
    });
    await expect(
      service.completeBlock(
        enrollmentId,
        blockId,
        { expectedCompletionVersion: 0, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: randomUUID() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'CURRICULUM_VERSION_CONFLICT', 409),
    );
  });

  it('bumps curriculum version when a published lesson leaves eligible curriculum', async () => {
    const lessons = new PrismaLessonManagementRepository(client);
    await lessons.updateLessonStatus(courseId, lessonId, LessonStatus.ARCHIVED, {
      actorUserId: adminId,
    });

    await expect(
      client.course.findUniqueOrThrow({ where: { id: courseId } }),
    ).resolves.toMatchObject({
      curriculumVersion: 2,
    });
  });

  it('freezes the reconciled progress snapshot when the student cancels enrollment', async () => {
    await service.completeBlock(
      enrollmentId,
      blockId,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: randomUUID() },
    );
    const enrollments = new CourseEnrollmentService(new PrismaCourseEnrollmentRepository(client));
    await enrollments.cancelOwn(
      enrollmentId,
      {
        userId: studentId,
        roles: [RoleCode.STUDENT],
        permissions: ['enrollments.self_cancel'],
      },
      { actorUserId: studentId },
    );

    const root = await client.enrollmentProgressRoot.findUniqueOrThrow({
      where: { enrollmentId },
    });
    expect(root).toMatchObject({
      completedEligibleBlocks: 1,
      totalEligibleBlocks: 1,
      completedLessons: 0,
      totalEligibleLessons: 2,
      coursePercentage: 0,
    });
    expect(root.frozenAt).toBeInstanceOf(Date);
    await expect(
      service.completeLesson(
        enrollmentId,
        lessonId,
        { expectedCompletionVersion: root.completionVersion, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: randomUUID() },
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ENROLLMENT_CANCELLED', 409));
  });

  it('creates and freezes a zero-state snapshot when cancellation precedes progress activity', async () => {
    const enrollments = new CourseEnrollmentService(new PrismaCourseEnrollmentRepository(client));
    await enrollments.cancelOwn(
      enrollmentId,
      {
        userId: studentId,
        roles: [RoleCode.STUDENT],
        permissions: ['enrollments.self_cancel'],
      },
      { actorUserId: studentId },
    );

    await expect(
      client.enrollmentProgressRoot.findUniqueOrThrow({ where: { enrollmentId } }),
    ).resolves.toMatchObject({
      curriculumVersion: 1,
      completionVersion: 0,
      completedEligibleBlocks: 0,
      totalEligibleBlocks: 1,
      completedLessons: 0,
      totalEligibleLessons: 2,
      coursePercentage: 0,
    });
  });
});
