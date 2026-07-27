import {
  BlockProgressState,
  CourseEnrollmentStatus,
  CourseStatus,
  LessonContentBlockType,
  LessonProgressState,
  type IdempotencyOperation,
} from '@prisma/client';
import type {
  ProgressTrackingRepository,
  ProgressTransactionRepository,
} from '../../src/modules/progress-tracking/progress-tracking.repository.js';
import type {
  CompletedCourseQuery,
  IdempotencyRecordData,
  ProgressAggregate,
  ProgressEnrollmentRecord,
  ProgressEventData,
  ProgressRootRecord,
} from '../../src/modules/progress-tracking/progress-tracking.types.js';

export const STUDENT_ID = '019d0000-0000-7000-8000-000000000001';
export const OTHER_STUDENT_ID = '019d0000-0000-7000-8000-000000000002';
export const ENROLLMENT_ID = '019d0000-0000-7000-8000-000000000003';
export const COURSE_ID = '019d0000-0000-7000-8000-000000000004';
export const SECTION_ID = '019d0000-0000-7000-8000-000000000005';
export const LESSON_ID = '019d0000-0000-7000-8000-000000000006';
export const SECOND_LESSON_ID = '019d0000-0000-7000-8000-000000000007';
export const BLOCK_ID = '019d0000-0000-7000-8000-000000000008';
export const OPTIONAL_BLOCK_ID = '019d0000-0000-7000-8000-000000000009';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createProgressEnrollment(
  overrides: Partial<ProgressEnrollmentRecord> = {},
): ProgressEnrollmentRecord {
  const enrollment: ProgressEnrollmentRecord = {
    id: ENROLLMENT_ID,
    studentId: STUDENT_ID,
    status: CourseEnrollmentStatus.ACTIVE,
    enrolledAt: new Date('2026-07-20T08:00:00.000Z'),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    suspendedAt: null,
    root: null,
    course: {
      id: COURSE_ID,
      title: 'Turk tili A1',
      slug: 'turk-tili-a1',
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date('2026-07-19T08:00:00.000Z'),
      deletedAt: null,
      curriculumVersion: 1,
      sections: [
        {
          id: SECTION_ID,
          title: 'Tanishuv',
          position: 1,
          lessons: [
            {
              id: LESSON_ID,
              sectionId: SECTION_ID,
              title: 'Salomlashish',
              slug: 'salomlashish',
              position: 1,
              progress: null,
              blocks: [
                {
                  id: BLOCK_ID,
                  blockType: LessonContentBlockType.TEXT,
                  title: 'Asosiy matn',
                  position: 1,
                  isRequired: true,
                  progress: null,
                },
                {
                  id: OPTIONAL_BLOCK_ID,
                  blockType: LessonContentBlockType.LINK,
                  title: 'Qo‘shimcha havola',
                  position: 2,
                  isRequired: false,
                  progress: null,
                },
              ],
            },
          ],
        },
      ],
    },
  };
  return { ...enrollment, ...overrides };
}

export class FakeProgressTrackingRepository
  implements ProgressTrackingRepository, ProgressTransactionRepository
{
  enrollment: ProgressEnrollmentRecord;
  idempotencyRecords: IdempotencyRecordData[] = [];
  events: ProgressEventData[] = [];
  transactionCount = 0;

  constructor(enrollment = createProgressEnrollment()) {
    this.enrollment = clone(enrollment);
  }

  async withSerializableTransaction<T>(
    operation: (transaction: ProgressTransactionRepository) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1;
    const snapshot = clone({
      enrollment: this.enrollment,
      idempotencyRecords: this.idempotencyRecords,
      events: this.events,
    });
    try {
      return await operation(this);
    } catch (error: unknown) {
      this.enrollment = snapshot.enrollment;
      this.idempotencyRecords = snapshot.idempotencyRecords;
      this.events = snapshot.events;
      throw error;
    }
  }

  async lockEnrollment(): Promise<void> {}
  async lockCourse(): Promise<void> {}
  async lockProgressRoot(): Promise<void> {}
  async lockLessonProgress(): Promise<void> {}
  async lockBlockProgress(): Promise<void> {}

  async findEnrollment(enrollmentId: string): Promise<ProgressEnrollmentRecord | null> {
    return enrollmentId === this.enrollment.id ? clone(this.enrollment) : null;
  }

  async ensureProgressRoot(
    enrollmentId: string,
    curriculumVersion: number,
  ): Promise<{ root: ProgressRootRecord; created: boolean }> {
    if (this.enrollment.root) return { root: clone(this.enrollment.root), created: false };
    const now = new Date();
    const root: ProgressRootRecord = {
      id: '019d0000-0000-7000-8000-000000000010',
      enrollmentId,
      lastVisitedLessonId: null,
      lastVisitedAt: null,
      firstActivityAt: null,
      completionVersion: 0,
      activityVersion: 0,
      curriculumVersion,
      completedEligibleBlocks: 0,
      totalEligibleBlocks: 0,
      completedLessons: 0,
      totalEligibleLessons: 0,
      coursePercentage: 0,
      frozenAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.enrollment.root = root;
    return { root: clone(root), created: true };
  }

  async updateProgressRoot(
    _enrollmentId: string,
    data: {
      aggregate?: ProgressAggregate;
      curriculumVersion?: number;
      completionVersion?: number;
      activityVersion?: number;
      firstActivityAt?: Date;
      lastVisitedLessonId?: string;
      lastVisitedAt?: Date;
      frozenAt?: Date;
    },
  ): Promise<ProgressRootRecord> {
    if (!this.enrollment.root) throw new Error('Progress root is missing.');
    this.enrollment.root = {
      ...this.enrollment.root,
      ...(data.aggregate ?? {}),
      ...(data.curriculumVersion !== undefined
        ? { curriculumVersion: data.curriculumVersion }
        : {}),
      ...(data.completionVersion !== undefined
        ? { completionVersion: data.completionVersion }
        : {}),
      ...(data.activityVersion !== undefined ? { activityVersion: data.activityVersion } : {}),
      ...(data.firstActivityAt ? { firstActivityAt: data.firstActivityAt } : {}),
      ...(data.lastVisitedLessonId ? { lastVisitedLessonId: data.lastVisitedLessonId } : {}),
      ...(data.lastVisitedAt ? { lastVisitedAt: data.lastVisitedAt } : {}),
      ...(data.frozenAt ? { frozenAt: data.frozenAt } : {}),
      updatedAt: new Date(),
    };
    return clone(this.enrollment.root);
  }

  async findIdempotencyRecord(
    actorUserId: string,
    key: string,
  ): Promise<IdempotencyRecordData | null> {
    return (
      clone(
        this.idempotencyRecords.find(
          (record) => record.actorUserId === actorUserId && record.key === key,
        ),
      ) ?? null
    );
  }

  async createIdempotencyRecord(data: {
    actorUserId: string;
    enrollmentId: string;
    key: string;
    operation: IdempotencyOperation;
    requestFingerprint: string;
    responseEnvelope: unknown;
    resultingCompletionVersion?: number;
    resultingActivityVersion?: number;
    expiresAt: Date;
  }): Promise<IdempotencyRecordData> {
    const record: IdempotencyRecordData = {
      id: `019d0000-0000-7000-8000-${String(this.idempotencyRecords.length + 20).padStart(12, '0')}`,
      actorUserId: data.actorUserId,
      enrollmentId: data.enrollmentId,
      key: data.key,
      operation: data.operation,
      requestFingerprint: data.requestFingerprint,
      responseStatus: 200,
      responseEnvelope: clone(data.responseEnvelope),
      resultingCompletionVersion: data.resultingCompletionVersion ?? null,
      resultingActivityVersion: data.resultingActivityVersion ?? null,
      expiresAt: data.expiresAt,
    };
    this.idempotencyRecords.push(record);
    return clone(record);
  }

  async upsertLessonActivity(
    _enrollmentId: string,
    lessonId: string,
    _curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void> {
    const lesson = this.lesson(lessonId);
    if (!lesson.progress) {
      lesson.progress = {
        state: LessonProgressState.IN_PROGRESS,
        firstActivityAt: occurredAt,
        lastActivityAt: occurredAt,
        completedAt: null,
      };
    } else {
      lesson.progress.lastActivityAt = occurredAt;
    }
  }

  async setLessonState(
    _enrollmentId: string,
    lessonId: string,
    state: LessonProgressState,
    _curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void> {
    const lesson = this.lesson(lessonId);
    lesson.progress = {
      state,
      firstActivityAt: lesson.progress?.firstActivityAt ?? occurredAt,
      lastActivityAt: occurredAt,
      completedAt: state === LessonProgressState.COMPLETED ? occurredAt : null,
    };
  }

  async setBlockState(
    _enrollmentId: string,
    blockId: string,
    state: BlockProgressState,
    _curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void> {
    const block = this.enrollment.course.sections
      .flatMap((section) => section.lessons)
      .flatMap((lesson) => lesson.blocks)
      .find((candidate) => candidate.id === blockId);
    if (!block) throw new Error('Block is missing.');
    block.progress = {
      state,
      completedAt: state === BlockProgressState.COMPLETED ? occurredAt : null,
    };
  }

  async completeEnrollment(_enrollmentId: string, occurredAt: Date): Promise<void> {
    this.enrollment.status = CourseEnrollmentStatus.COMPLETED;
    this.enrollment.completedAt = occurredAt;
  }

  async createProgressEvent(data: ProgressEventData): Promise<void> {
    this.events.push(clone(data));
  }

  async listOwnActiveEnrollmentIds(
    studentId: string,
    limit: number,
  ): Promise<{ enrollmentIds: string[]; activeCount: number; completedCount: number }> {
    const owned = this.enrollment.studentId === studentId;
    return {
      enrollmentIds:
        owned && this.enrollment.status === CourseEnrollmentStatus.ACTIVE
          ? [this.enrollment.id].slice(0, limit)
          : [],
      activeCount: owned && this.enrollment.status === CourseEnrollmentStatus.ACTIVE ? 1 : 0,
      completedCount: owned && this.enrollment.status === CourseEnrollmentStatus.COMPLETED ? 1 : 0,
    };
  }

  async listOwnCompletedEnrollmentIds(
    studentId: string,
    _query: CompletedCourseQuery,
  ): Promise<{ enrollmentIds: string[]; total: number }> {
    const included =
      this.enrollment.studentId === studentId &&
      this.enrollment.status === CourseEnrollmentStatus.COMPLETED &&
      this.enrollment.root?.coursePercentage === 100;
    return { enrollmentIds: included ? [this.enrollment.id] : [], total: included ? 1 : 0 };
  }

  private lesson(lessonId: string) {
    const lesson = this.enrollment.course.sections
      .flatMap((section) => section.lessons)
      .find((candidate) => candidate.id === lessonId);
    if (!lesson) throw new Error('Lesson is missing.');
    return lesson;
  }
}
