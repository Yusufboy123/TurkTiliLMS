import { CourseEnrollmentSource, CourseEnrollmentStatus, CourseStatus } from '@prisma/client';
import { CourseEnrollmentService } from '../../src/modules/course-enrollments/course-enrollment.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  ADMIN_ID,
  COURSE_ID,
  ENROLLMENT_ID,
  OTHER_TEACHER_ID,
  STUDENT_ID,
  FakeCourseEnrollmentRepository,
  adminActor,
  createEnrollmentCourse,
  createEnrollmentRecord,
  enrollmentAuditContext,
  studentActor,
  teacherActor,
} from '../helpers/course-enrollment-fakes.js';

const listQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'enrolledAt' as const,
  sortDirection: 'desc' as const,
};

function expectAppError(error: unknown, code: string, statusCode: number): boolean {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode });
  return true;
}

describe('CourseEnrollmentService', () => {
  it('denies direct self-service calls without the required service permission', async () => {
    const service = new CourseEnrollmentService(new FakeCourseEnrollmentRepository());
    await expect(
      service.selfEnroll(
        COURSE_ID,
        { ...studentActor, permissions: [] },
        { actorUserId: STUDENT_ID },
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
    await expect(
      service.listOwn(listQuery, { ...studentActor, permissions: [] }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
  });

  it('denies direct management calls without the required service permission or role', async () => {
    const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    const service = new CourseEnrollmentService(repository);

    await expect(
      service.createManaged(
        COURSE_ID,
        STUDENT_ID,
        { ...adminActor, permissions: [] },
        enrollmentAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
    await expect(
      service.listCourse(COURSE_ID, listQuery, { ...teacherActor, permissions: [] }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
    await expect(
      service.getManaged(ENROLLMENT_ID, {
        ...studentActor,
        permissions: ['enrollments.read'],
      }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
    await expect(
      service.updateStatus(
        ENROLLMENT_ID,
        CourseEnrollmentStatus.SUSPENDED,
        { ...adminActor, permissions: [] },
        enrollmentAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
  });

  it('creates a self enrollment without accepting an administrative creator', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    const service = new CourseEnrollmentService(repository);
    const result = await service.selfEnroll(COURSE_ID, studentActor, {
      actorUserId: STUDENT_ID,
    });
    expect(result.source).toBe(CourseEnrollmentSource.SELF);
    expect(repository.lastCreateData).toMatchObject({
      courseId: COURSE_ID,
      studentId: STUDENT_ID,
      createdById: null,
    });
  });

  it('creates an ADMIN-source enrollment and stores its actor', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    const service = new CourseEnrollmentService(repository);
    await service.createManaged(COURSE_ID, STUDENT_ID, adminActor, enrollmentAuditContext);
    expect(repository.lastCreateData).toMatchObject({
      source: CourseEnrollmentSource.ADMIN,
      createdById: ADMIN_ID,
    });
  });

  it('rejects enrollment in an unpublished or deleted course', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    repository.course = createEnrollmentCourse({
      status: CourseStatus.DRAFT,
      publishedAt: null,
    });
    const service = new CourseEnrollmentService(repository);
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'COURSE_NOT_ENROLLABLE', 409));
  });

  it('returns not found for a nonexistent course', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    repository.course = null;
    const service = new CourseEnrollmentService(repository);
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'COURSE_NOT_FOUND', 404));
  });

  it('rejects a soft-deleted published course', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    repository.course = createEnrollmentCourse({ deletedAt: new Date() });
    const service = new CourseEnrollmentService(repository);
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'COURSE_NOT_ENROLLABLE', 409));
  });

  it('rejects a user without a currently valid STUDENT role', async () => {
    const repository = new FakeCourseEnrollmentRepository();
    repository.student = null;
    const service = new CourseEnrollmentService(repository);
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'STUDENT_NOT_ELIGIBLE', 422));
  });

  it('rejects duplicate active enrollment', async () => {
    const service = new CourseEnrollmentService(
      new FakeCourseEnrollmentRepository([createEnrollmentRecord()]),
    );
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ALREADY_ENROLLED', 409));
  });

  it('creates a new lifecycle row after cancellation', async () => {
    const repository = new FakeCourseEnrollmentRepository([
      createEnrollmentRecord({
        status: CourseEnrollmentStatus.CANCELLED,
        cancelledAt: new Date(),
      }),
    ]);
    const service = new CourseEnrollmentService(repository);
    const reenrolled = await service.selfEnroll(COURSE_ID, studentActor, {
      actorUserId: STUDENT_ID,
    });
    expect(repository.records).toHaveLength(2);
    expect(reenrolled.status).toBe(CourseEnrollmentStatus.ACTIVE);
  });

  it('does not reopen a completed lifecycle through self-enrollment', async () => {
    const service = new CourseEnrollmentService(
      new FakeCourseEnrollmentRepository([
        createEnrollmentRecord({
          status: CourseEnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        }),
      ]),
    );
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ENROLLMENT_COMPLETED', 409));
  });

  it('does not create another row beside a suspended enrollment', async () => {
    const service = new CourseEnrollmentService(
      new FakeCourseEnrollmentRepository([
        createEnrollmentRecord({
          status: CourseEnrollmentStatus.SUSPENDED,
          suspendedAt: new Date(),
        }),
      ]),
    );
    await expect(
      service.selfEnroll(COURSE_ID, studentActor, { actorUserId: STUDENT_ID }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ENROLLMENT_SUSPENDED', 409));
  });

  it('scopes self listing to the authenticated student', async () => {
    const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    const service = new CourseEnrollmentService(repository);
    const result = await service.listOwn(listQuery, studentActor);
    expect(result.pagination.totalItems).toBe(1);
    expect(repository.lastListQuery?.studentId).toBe(STUDENT_ID);
  });

  it('preserves own filters and manager source filtering', async () => {
    const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    const service = new CourseEnrollmentService(repository);
    await service.listOwn(
      {
        ...listQuery,
        courseId: COURSE_ID,
        status: CourseEnrollmentStatus.ACTIVE,
      },
      studentActor,
    );
    expect(repository.lastListQuery).toMatchObject({
      courseId: COURSE_ID,
      studentId: STUDENT_ID,
      status: CourseEnrollmentStatus.ACTIVE,
    });
    await service.listCourse(
      COURSE_ID,
      { ...listQuery, source: CourseEnrollmentSource.SELF },
      adminActor,
    );
    expect(repository.lastListQuery).toMatchObject({
      courseId: COURSE_ID,
      source: CourseEnrollmentSource.SELF,
    });
  });

  it('hides another student enrollment as not found', async () => {
    const repository = new FakeCourseEnrollmentRepository([
      createEnrollmentRecord({ studentId: ADMIN_ID }),
    ]);
    const service = new CourseEnrollmentService(repository);
    await expect(service.getOwn(ENROLLMENT_ID, studentActor)).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'ENROLLMENT_NOT_FOUND', 404),
    );
  });

  it('allows the owner to cancel ACTIVE but not COMPLETED enrollment', async () => {
    const activeRepository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    const activeService = new CourseEnrollmentService(activeRepository);
    const cancelled = await activeService.cancelOwn(ENROLLMENT_ID, studentActor, {
      actorUserId: STUDENT_ID,
    });
    expect(cancelled.status).toBe(CourseEnrollmentStatus.CANCELLED);

    const completedService = new CourseEnrollmentService(
      new FakeCourseEnrollmentRepository([
        createEnrollmentRecord({
          status: CourseEnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        }),
      ]),
    );
    await expect(
      completedService.cancelOwn(ENROLLMENT_ID, studentActor, {
        actorUserId: STUDENT_ID,
      }),
    ).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'ENROLLMENT_NOT_CANCELLABLE', 409),
    );
  });

  it('enforces assigned-teacher course scope', async () => {
    const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    repository.course = createEnrollmentCourse({ teacherId: OTHER_TEACHER_ID });
    const service = new CourseEnrollmentService(repository);
    await expect(service.listCourse(COURSE_ID, listQuery, teacherActor)).rejects.toSatisfy(
      (error: unknown) => expectAppError(error, 'COURSE_SCOPE_DENIED', 403),
    );
  });

  it('supports only the explicit lifecycle transitions', async () => {
    const repository = new FakeCourseEnrollmentRepository([createEnrollmentRecord()]);
    const service = new CourseEnrollmentService(repository);
    const suspended = await service.updateStatus(
      ENROLLMENT_ID,
      CourseEnrollmentStatus.SUSPENDED,
      adminActor,
      enrollmentAuditContext,
    );
    expect(suspended.suspendedAt).not.toBeNull();
    const active = await service.updateStatus(
      ENROLLMENT_ID,
      CourseEnrollmentStatus.ACTIVE,
      adminActor,
      enrollmentAuditContext,
    );
    expect(active.status).toBe(CourseEnrollmentStatus.ACTIVE);
    expect(active.suspendedAt).toBeNull();
  });

  it('revalidates course and student eligibility before reactivation', async () => {
    const unpublishedRepository = new FakeCourseEnrollmentRepository([
      createEnrollmentRecord({
        status: CourseEnrollmentStatus.SUSPENDED,
        suspendedAt: new Date(),
      }),
    ]);
    unpublishedRepository.course = createEnrollmentCourse({
      status: CourseStatus.DRAFT,
      publishedAt: null,
    });
    await expect(
      new CourseEnrollmentService(unpublishedRepository).updateStatus(
        ENROLLMENT_ID,
        CourseEnrollmentStatus.ACTIVE,
        adminActor,
        enrollmentAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'COURSE_NOT_ENROLLABLE', 409));

    const ineligibleStudentRepository = new FakeCourseEnrollmentRepository([
      createEnrollmentRecord({
        status: CourseEnrollmentStatus.SUSPENDED,
        suspendedAt: new Date(),
      }),
    ]);
    ineligibleStudentRepository.student = null;
    await expect(
      new CourseEnrollmentService(ineligibleStudentRepository).updateStatus(
        ENROLLMENT_ID,
        CourseEnrollmentStatus.ACTIVE,
        adminActor,
        enrollmentAuditContext,
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'STUDENT_NOT_ELIGIBLE', 422));
  });

  it('keeps COMPLETED terminal and requires re-enrollment for CANCELLED', async () => {
    for (const status of [CourseEnrollmentStatus.COMPLETED, CourseEnrollmentStatus.CANCELLED]) {
      const repository = new FakeCourseEnrollmentRepository([
        createEnrollmentRecord({
          status,
          completedAt: status === CourseEnrollmentStatus.COMPLETED ? new Date() : null,
          cancelledAt: status === CourseEnrollmentStatus.CANCELLED ? new Date() : null,
        }),
      ]);
      const service = new CourseEnrollmentService(repository);
      await expect(
        service.updateStatus(
          ENROLLMENT_ID,
          CourseEnrollmentStatus.ACTIVE,
          adminActor,
          enrollmentAuditContext,
        ),
      ).rejects.toSatisfy((error: unknown) =>
        expectAppError(error, 'INVALID_ENROLLMENT_STATUS_TRANSITION', 409),
      );
    }
  });
});
