import {
  BlockProgressState,
  CourseEnrollmentStatus,
  CourseStatus,
  LessonContentBlockType,
  LessonProgressState,
  ProgressEventType,
  RoleCode,
} from '@prisma/client';
import { ProgressTrackingService } from '../../src/modules/progress-tracking/progress-tracking.service.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  BLOCK_ID,
  ENROLLMENT_ID,
  LESSON_ID,
  OTHER_STUDENT_ID,
  SECOND_LESSON_ID,
  SECTION_ID,
  STUDENT_ID,
  FakeProgressTrackingRepository,
  createProgressEnrollment,
} from '../helpers/progress-tracking-fakes.js';

const COMPLETE_KEY = '019d0000-0000-7000-8000-000000000101';
const REOPEN_KEY = '019d0000-0000-7000-8000-000000000102';
const VISIT_KEY = '019d0000-0000-7000-8000-000000000103';

function actor(
  permissions: string[] = [
    'progress.self_read',
    'progress.self_complete',
    'progress.self_reopen',
    'progress.self_record_visit',
  ],
) {
  return {
    userId: STUDENT_ID,
    roles: [RoleCode.STUDENT],
    permissions,
  };
}

function expectAppError(error: unknown, code: string, statusCode: number): boolean {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode });
  return true;
}

describe('ProgressTrackingService', () => {
  it('enforces direct service role, permission, and ownership policies', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);

    await expect(
      service.getOwnEnrollmentProgress(ENROLLMENT_ID, {
        userId: STUDENT_ID,
        roles: [RoleCode.ADMIN],
        permissions: ['progress.self_read'],
      }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403));
    await expect(service.getOwnEnrollmentProgress(ENROLLMENT_ID, actor([]))).rejects.toSatisfy(
      (error: unknown) => expectAppError(error, 'ACCESS_DENIED', 403),
    );
    await expect(
      service.getOwnEnrollmentProgress(ENROLLMENT_ID, {
        ...actor(),
        userId: OTHER_STUDENT_ID,
      }),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ENROLLMENT_NOT_FOUND', 404));
  });

  it('creates and reconciles an enrollment-scoped root for authoritative reads', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);

    const progress = await service.getOwnEnrollmentProgress(ENROLLMENT_ID, actor());

    expect(progress).toMatchObject({
      enrollmentId: ENROLLMENT_ID,
      curriculumVersion: 1,
      completionVersion: 0,
      activityVersion: 0,
      completedEligibleBlocks: 0,
      totalEligibleBlocks: 1,
      completedLessons: 0,
      totalEligibleLessons: 1,
      percentage: 0,
    });
    expect(repository.enrollment.root).toMatchObject({
      enrollmentId: ENROLLMENT_ID,
      totalEligibleBlocks: 1,
      totalEligibleLessons: 1,
    });
  });

  it('records a lesson visit without changing completionVersion or creating an event', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);

    const result = await service.recordLastVisitedLesson(
      ENROLLMENT_ID,
      { lessonId: LESSON_ID, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: VISIT_KEY },
    );

    expect(result.replayed).toBe(false);
    expect(result.envelope.data).toMatchObject({
      changed: true,
      completionVersion: 0,
      activityVersion: 1,
      lastVisitedLessonId: LESSON_ID,
    });
    expect(repository.events).toHaveLength(0);
    expect(repository.enrollment.course.sections[0]?.lessons[0]?.progress?.state).toBe(
      LessonProgressState.IN_PROGRESS,
    );
  });

  it('completes a sparse block, updates aggregates, and stores one fixed event', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);

    const result = await service.completeBlock(
      ENROLLMENT_ID,
      BLOCK_ID,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: COMPLETE_KEY },
    );

    expect(result.envelope.data).toMatchObject({
      changed: true,
      completionVersion: 1,
      affectedLesson: {
        status: 'READY_TO_COMPLETE',
        completedEligibleBlocks: 1,
        totalEligibleBlocks: 1,
        percentage: 100,
      },
    });
    expect(repository.enrollment.course.sections[0]?.lessons[0]?.blocks[0]?.progress).toMatchObject(
      {
        state: BlockProgressState.COMPLETED,
      },
    );
    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.eventType).toBe(ProgressEventType.BLOCK_COMPLETED);
  });

  it('replays an identical idempotency key and rejects a changed fingerprint', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);
    const input = { expectedCompletionVersion: 0, curriculumVersion: 1 };
    const first = await service.completeBlock(ENROLLMENT_ID, BLOCK_ID, input, actor(), {
      idempotencyKey: COMPLETE_KEY,
    });
    const replay = await service.completeBlock(ENROLLMENT_ID, BLOCK_ID, input, actor(), {
      idempotencyKey: COMPLETE_KEY,
    });

    expect(replay).toEqual({ envelope: first.envelope, replayed: true });
    expect(repository.events).toHaveLength(1);
    await expect(
      service.completeBlock(
        ENROLLMENT_ID,
        BLOCK_ID,
        { expectedCompletionVersion: 1, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: COMPLETE_KEY },
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'IDEMPOTENCY_KEY_CONFLICT', 409));
  });

  it('returns changed=false for an ordinary repeated completion with a new key', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);
    await service.completeBlock(
      ENROLLMENT_ID,
      BLOCK_ID,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: COMPLETE_KEY },
    );

    const repeated = await service.completeBlock(
      ENROLLMENT_ID,
      BLOCK_ID,
      { expectedCompletionVersion: 1, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: '019d0000-0000-7000-8000-000000000104' },
    );

    expect(repeated.envelope.data.changed).toBe(false);
    expect(repeated.envelope.data.completionVersion).toBe(1);
    expect(repository.events).toHaveLength(1);
  });

  it('requires every required block before lesson completion', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);

    await expect(
      service.completeLesson(
        ENROLLMENT_ID,
        LESSON_ID,
        { expectedCompletionVersion: 0, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: COMPLETE_KEY },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'LESSON_COMPLETION_REQUIREMENTS_NOT_MET', 409),
    );
    expect(repository.idempotencyRecords).toHaveLength(0);
    expect(repository.events).toHaveLength(0);
  });

  it('atomically completes the enrollment and freezes the final snapshot', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);
    await service.completeBlock(
      ENROLLMENT_ID,
      BLOCK_ID,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: COMPLETE_KEY },
    );

    const result = await service.completeLesson(
      ENROLLMENT_ID,
      LESSON_ID,
      { expectedCompletionVersion: 1, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: '019d0000-0000-7000-8000-000000000105' },
    );

    expect(result.envelope.data).toMatchObject({
      changed: true,
      completionVersion: 2,
      course: {
        enrollmentStatus: CourseEnrollmentStatus.COMPLETED,
        status: 'COMPLETED',
        percentage: 100,
      },
    });
    expect(repository.enrollment.status).toBe(CourseEnrollmentStatus.COMPLETED);
    expect(repository.enrollment.root?.frozenAt).toBeInstanceOf(Date);
    expect(repository.events.map((event) => event.eventType)).toEqual([
      ProgressEventType.BLOCK_COMPLETED,
      ProgressEventType.LESSON_COMPLETED,
      ProgressEventType.COURSE_COMPLETED,
    ]);
  });

  it('supports lesson reopen before terminal completion and keeps block state intact', async () => {
    const enrollment = createProgressEnrollment();
    enrollment.course.sections[0]?.lessons.push({
      id: SECOND_LESSON_ID,
      sectionId: SECTION_ID,
      title: 'Ikkinchi dars',
      slug: 'ikkinchi-dars',
      position: 2,
      progress: null,
      blocks: [],
    });
    const repository = new FakeProgressTrackingRepository(enrollment);
    const service = new ProgressTrackingService(repository);
    await service.completeBlock(
      ENROLLMENT_ID,
      BLOCK_ID,
      { expectedCompletionVersion: 0, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: COMPLETE_KEY },
    );
    await service.completeLesson(
      ENROLLMENT_ID,
      LESSON_ID,
      { expectedCompletionVersion: 1, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: '019d0000-0000-7000-8000-000000000106' },
    );

    const reopened = await service.reopenLesson(
      ENROLLMENT_ID,
      LESSON_ID,
      { expectedCompletionVersion: 2, curriculumVersion: 1 },
      actor(),
      { idempotencyKey: REOPEN_KEY },
    );

    expect(reopened.envelope.data).toMatchObject({
      changed: true,
      completionVersion: 3,
      affectedLesson: { status: 'READY_TO_COMPLETE' },
      course: { percentage: 0 },
    });
    expect(repository.events.at(-1)?.eventType).toBe(ProgressEventType.LESSON_REOPENED);
  });

  it('rejects stale versions, unavailable content, and frozen enrollment states', async () => {
    const repository = new FakeProgressTrackingRepository();
    const service = new ProgressTrackingService(repository);
    await expect(
      service.completeBlock(
        ENROLLMENT_ID,
        BLOCK_ID,
        { expectedCompletionVersion: 0, curriculumVersion: 2 },
        actor(),
        { idempotencyKey: COMPLETE_KEY },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'CURRICULUM_VERSION_CONFLICT', 409),
    );

    repository.enrollment.course.status = CourseStatus.ARCHIVED;
    await expect(
      service.completeBlock(
        ENROLLMENT_ID,
        BLOCK_ID,
        { expectedCompletionVersion: 0, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: COMPLETE_KEY },
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'COURSE_UNAVAILABLE', 409));

    repository.enrollment.course.status = CourseStatus.PUBLISHED;
    repository.enrollment.status = CourseEnrollmentStatus.SUSPENDED;
    await expect(
      service.recordLastVisitedLesson(
        ENROLLMENT_ID,
        { lessonId: LESSON_ID, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: VISIT_KEY },
      ),
    ).rejects.toSatisfy((error: unknown) => expectAppError(error, 'ENROLLMENT_SUSPENDED', 409));
  });

  it('rejects a block reopen that would invalidate a still-completed lesson', async () => {
    const enrollment = createProgressEnrollment();
    const lesson = enrollment.course.sections[0]?.lessons[0];
    if (!lesson) throw new Error('Fixture lesson is missing.');
    lesson.progress = {
      state: LessonProgressState.COMPLETED,
      firstActivityAt: new Date(),
      lastActivityAt: new Date(),
      completedAt: new Date(),
    };
    const block = lesson.blocks[0];
    if (!block) throw new Error('Fixture block is missing.');
    block.progress = { state: BlockProgressState.COMPLETED, completedAt: new Date() };
    enrollment.course.sections[0]?.lessons.push({
      id: SECOND_LESSON_ID,
      sectionId: SECTION_ID,
      title: 'Ikkinchi dars',
      slug: 'ikkinchi-dars',
      position: 2,
      progress: null,
      blocks: [
        {
          id: '019d0000-0000-7000-8000-000000000011',
          blockType: LessonContentBlockType.TEXT,
          title: null,
          position: 1,
          isRequired: true,
          progress: null,
        },
      ],
    });
    const repository = new FakeProgressTrackingRepository(enrollment);
    const service = new ProgressTrackingService(repository);
    await service.getOwnEnrollmentProgress(ENROLLMENT_ID, actor());

    await expect(
      service.reopenBlock(
        ENROLLMENT_ID,
        BLOCK_ID,
        { expectedCompletionVersion: 0, curriculumVersion: 1 },
        actor(),
        { idempotencyKey: REOPEN_KEY },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectAppError(error, 'INVALID_PROGRESS_TRANSITION', 409),
    );
  });
});
