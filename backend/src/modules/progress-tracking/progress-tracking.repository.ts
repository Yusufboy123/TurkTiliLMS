import {
  BlockProgressState,
  CourseEnrollmentStatus,
  LessonProgressState,
  Prisma,
  type IdempotencyOperation,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CompletedCourseQuery,
  IdempotencyRecordData,
  ProgressAggregate,
  ProgressEnrollmentRecord,
  ProgressEventData,
  ProgressRootRecord,
} from './progress-tracking.types.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
const IDEMPOTENCY_UNIQUE_CONSTRAINT = 'idempotency_records_actor_user_id_key_key';
const PROGRESS_ROOT_UNIQUE_CONSTRAINT = 'enrollment_progress_roots_enrollment_id_key';

const rootSelect = {
  id: true,
  enrollmentId: true,
  lastVisitedLessonId: true,
  lastVisitedAt: true,
  firstActivityAt: true,
  completionVersion: true,
  activityVersion: true,
  curriculumVersion: true,
  completedEligibleBlocks: true,
  totalEligibleBlocks: true,
  completedLessons: true,
  totalEligibleLessons: true,
  coursePercentage: true,
  frozenAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EnrollmentProgressRootSelect;

function mapRoot(
  root: Prisma.EnrollmentProgressRootGetPayload<{ select: typeof rootSelect }>,
): ProgressRootRecord {
  return root;
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  return error.code === 'P2010' && error.meta?.code === '40001';
}

function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (typeof target === 'string') return [target];
  return Array.isArray(target)
    ? target.filter((value): value is string => typeof value === 'string')
    : [];
}

function hasExactUniqueFields(targets: string[], expected: string[]): boolean {
  return (
    targets.length === expected.length &&
    expected.every((field) => targets.some((target) => target === field))
  );
}

function isRetryableProgressUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const targets = uniqueTarget(error);
  return (
    targets.some(
      (target) =>
        target === IDEMPOTENCY_UNIQUE_CONSTRAINT || target === PROGRESS_ROOT_UNIQUE_CONSTRAINT,
    ) ||
    hasExactUniqueFields(targets, ['actor_user_id', 'key']) ||
    hasExactUniqueFields(targets, ['actorUserId', 'key']) ||
    hasExactUniqueFields(targets, ['enrollment_id']) ||
    hasExactUniqueFields(targets, ['enrollmentId'])
  );
}

export class ProgressTransactionConflictError extends Error {}

export interface ProgressTransactionRepository {
  lockEnrollment(enrollmentId: string): Promise<void>;
  lockCourse(courseId: string): Promise<void>;
  lockProgressRoot(enrollmentId: string): Promise<void>;
  lockLessonProgress(enrollmentId: string, lessonId: string): Promise<void>;
  lockBlockProgress(enrollmentId: string, blockId: string): Promise<void>;
  findEnrollment(enrollmentId: string): Promise<ProgressEnrollmentRecord | null>;
  ensureProgressRoot(
    enrollmentId: string,
    curriculumVersion: number,
  ): Promise<{ root: ProgressRootRecord; created: boolean }>;
  updateProgressRoot(
    enrollmentId: string,
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
  ): Promise<ProgressRootRecord>;
  findIdempotencyRecord(actorUserId: string, key: string): Promise<IdempotencyRecordData | null>;
  createIdempotencyRecord(data: {
    actorUserId: string;
    enrollmentId: string;
    key: string;
    operation: IdempotencyOperation;
    requestFingerprint: string;
    responseEnvelope: unknown;
    resultingCompletionVersion?: number;
    resultingActivityVersion?: number;
    expiresAt: Date;
  }): Promise<IdempotencyRecordData>;
  upsertLessonActivity(
    enrollmentId: string,
    lessonId: string,
    curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void>;
  setLessonState(
    enrollmentId: string,
    lessonId: string,
    state: LessonProgressState,
    curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void>;
  setBlockState(
    enrollmentId: string,
    blockId: string,
    state: BlockProgressState,
    curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void>;
  completeEnrollment(enrollmentId: string, occurredAt: Date): Promise<void>;
  createProgressEvent(data: ProgressEventData): Promise<void>;
}

export interface ProgressTrackingRepository {
  withSerializableTransaction<T>(
    operation: (transaction: ProgressTransactionRepository) => Promise<T>,
  ): Promise<T>;
  listOwnActiveEnrollmentIds(
    studentId: string,
    limit: number,
  ): Promise<{ enrollmentIds: string[]; activeCount: number; completedCount: number }>;
  listOwnCompletedEnrollmentIds(
    studentId: string,
    query: CompletedCourseQuery,
  ): Promise<{ enrollmentIds: string[]; total: number }>;
}

class PrismaProgressTransactionRepository implements ProgressTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async lockEnrollment(enrollmentId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "course_enrollments"
      WHERE "id" = ${enrollmentId}::uuid
      FOR UPDATE
    `;
  }

  async lockCourse(courseId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "courses"
      WHERE "id" = ${courseId}::uuid
      FOR UPDATE
    `;
  }

  async lockProgressRoot(enrollmentId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "enrollment_progress_roots"
      WHERE "enrollment_id" = ${enrollmentId}::uuid
      FOR UPDATE
    `;
  }

  async lockLessonProgress(enrollmentId: string, lessonId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "lesson_progress"
      WHERE "enrollment_id" = ${enrollmentId}::uuid
        AND "lesson_id" = ${lessonId}::uuid
      FOR UPDATE
    `;
  }

  async lockBlockProgress(enrollmentId: string, blockId: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT "id"
      FROM "block_progress"
      WHERE "enrollment_id" = ${enrollmentId}::uuid
        AND "block_id" = ${blockId}::uuid
      FOR UPDATE
    `;
  }

  async findEnrollment(enrollmentId: string): Promise<ProgressEnrollmentRecord | null> {
    const enrollment = await this.transaction.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        studentId: true,
        status: true,
        enrolledAt: true,
        startedAt: true,
        completedAt: true,
        cancelledAt: true,
        suspendedAt: true,
        progressRoot: { select: rootSelect },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            publishedAt: true,
            deletedAt: true,
            curriculumVersion: true,
            sections: {
              where: { isPublished: true, deletedAt: null },
              orderBy: [{ position: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                title: true,
                position: true,
                lessons: {
                  where: { status: 'PUBLISHED', deletedAt: null },
                  orderBy: [{ position: 'asc' }, { id: 'asc' }],
                  select: {
                    id: true,
                    sectionId: true,
                    title: true,
                    slug: true,
                    position: true,
                    progress: {
                      where: { enrollmentId },
                      take: 1,
                      select: {
                        state: true,
                        firstActivityAt: true,
                        lastActivityAt: true,
                        completedAt: true,
                      },
                    },
                    contentBlocks: {
                      where: { isVisible: true, deletedAt: null },
                      orderBy: [{ position: 'asc' }, { id: 'asc' }],
                      select: {
                        id: true,
                        blockType: true,
                        title: true,
                        position: true,
                        isRequired: true,
                        progress: {
                          where: { enrollmentId },
                          take: 1,
                          select: { state: true, completedAt: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!enrollment) return null;

    return {
      id: enrollment.id,
      studentId: enrollment.studentId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      startedAt: enrollment.startedAt,
      completedAt: enrollment.completedAt,
      cancelledAt: enrollment.cancelledAt,
      suspendedAt: enrollment.suspendedAt,
      root: enrollment.progressRoot ? mapRoot(enrollment.progressRoot) : null,
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        slug: enrollment.course.slug,
        status: enrollment.course.status,
        publishedAt: enrollment.course.publishedAt,
        deletedAt: enrollment.course.deletedAt,
        curriculumVersion: enrollment.course.curriculumVersion,
        sections: enrollment.course.sections.map((section) => ({
          id: section.id,
          title: section.title,
          position: section.position,
          lessons: section.lessons.map((lesson) => ({
            id: lesson.id,
            sectionId: lesson.sectionId,
            title: lesson.title,
            slug: lesson.slug,
            position: lesson.position,
            progress: lesson.progress[0] ?? null,
            blocks: lesson.contentBlocks.map((block) => ({
              id: block.id,
              blockType: block.blockType,
              title: block.title,
              position: block.position,
              isRequired: block.isRequired,
              progress: block.progress[0] ?? null,
            })),
          })),
        })),
      },
    };
  }

  async ensureProgressRoot(
    enrollmentId: string,
    curriculumVersion: number,
  ): Promise<{ root: ProgressRootRecord; created: boolean }> {
    const existing = await this.transaction.enrollmentProgressRoot.findUnique({
      where: { enrollmentId },
      select: rootSelect,
    });
    if (existing) return { root: mapRoot(existing), created: false };
    const created = await this.transaction.enrollmentProgressRoot.create({
      data: { enrollmentId, curriculumVersion },
      select: rootSelect,
    });
    return { root: mapRoot(created), created: true };
  }

  async updateProgressRoot(
    enrollmentId: string,
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
    const updated = await this.transaction.enrollmentProgressRoot.update({
      where: { enrollmentId },
      data: {
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
      },
      select: rootSelect,
    });
    return mapRoot(updated);
  }

  async findIdempotencyRecord(
    actorUserId: string,
    key: string,
  ): Promise<IdempotencyRecordData | null> {
    const record = await this.transaction.idempotencyRecord.findUnique({
      where: { actorUserId_key: { actorUserId, key } },
    });
    return record;
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
    return this.transaction.idempotencyRecord.create({
      data: {
        actorUserId: data.actorUserId,
        enrollmentId: data.enrollmentId,
        key: data.key,
        operation: data.operation,
        requestFingerprint: data.requestFingerprint,
        responseStatus: 200,
        responseEnvelope: JSON.parse(
          JSON.stringify(data.responseEnvelope),
        ) as Prisma.InputJsonValue,
        ...(data.resultingCompletionVersion !== undefined
          ? { resultingCompletionVersion: data.resultingCompletionVersion }
          : {}),
        ...(data.resultingActivityVersion !== undefined
          ? { resultingActivityVersion: data.resultingActivityVersion }
          : {}),
        expiresAt: data.expiresAt,
      },
    });
  }

  async upsertLessonActivity(
    enrollmentId: string,
    lessonId: string,
    curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void> {
    await this.transaction.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: {
        enrollmentId,
        lessonId,
        state: LessonProgressState.IN_PROGRESS,
        curriculumVersion,
        firstActivityAt: occurredAt,
        lastActivityAt: occurredAt,
      },
      update: {
        curriculumVersion,
        lastActivityAt: occurredAt,
      },
    });
  }

  async setLessonState(
    enrollmentId: string,
    lessonId: string,
    state: LessonProgressState,
    curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void> {
    await this.transaction.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: {
        enrollmentId,
        lessonId,
        state,
        curriculumVersion,
        firstActivityAt: occurredAt,
        lastActivityAt: occurredAt,
        completedAt: state === LessonProgressState.COMPLETED ? occurredAt : null,
      },
      update: {
        state,
        curriculumVersion,
        lastActivityAt: occurredAt,
        completedAt: state === LessonProgressState.COMPLETED ? occurredAt : null,
      },
    });
  }

  async setBlockState(
    enrollmentId: string,
    blockId: string,
    state: BlockProgressState,
    curriculumVersion: number,
    occurredAt: Date,
  ): Promise<void> {
    await this.transaction.blockProgress.upsert({
      where: { enrollmentId_blockId: { enrollmentId, blockId } },
      create: {
        enrollmentId,
        blockId,
        state,
        curriculumVersion,
        completedAt: state === BlockProgressState.COMPLETED ? occurredAt : null,
      },
      update: {
        state,
        curriculumVersion,
        completedAt: state === BlockProgressState.COMPLETED ? occurredAt : null,
      },
    });
  }

  async completeEnrollment(enrollmentId: string, occurredAt: Date): Promise<void> {
    const update = await this.transaction.courseEnrollment.updateMany({
      where: { id: enrollmentId, status: CourseEnrollmentStatus.ACTIVE },
      data: {
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: occurredAt,
        suspendedAt: null,
        cancelledAt: null,
      },
    });
    if (update.count !== 1) throw new ProgressTransactionConflictError();
  }

  async createProgressEvent(data: ProgressEventData): Promise<void> {
    await this.transaction.progressEvent.create({
      data: {
        enrollmentId: data.enrollmentId,
        actorUserId: data.actorUserId,
        eventType: data.eventType,
        lessonId: data.lessonId,
        blockId: data.blockId,
        previousState: data.previousState,
        newState: data.newState,
        curriculumVersion: data.curriculumVersion,
        resultingCompletionVersion: data.resultingCompletionVersion,
        idempotencyRecordId: data.idempotencyRecordId,
        ...(data.requestCorrelationId ? { requestCorrelationId: data.requestCorrelationId } : {}),
        ...(data.snapshot
          ? {
              snapshotCompletedEligibleBlocks: data.snapshot.completedEligibleBlocks,
              snapshotTotalEligibleBlocks: data.snapshot.totalEligibleBlocks,
              snapshotCompletedLessons: data.snapshot.completedLessons,
              snapshotTotalEligibleLessons: data.snapshot.totalEligibleLessons,
              snapshotCoursePercentage: data.snapshot.coursePercentage,
            }
          : {}),
      },
    });
  }
}

export class PrismaProgressTrackingRepository implements ProgressTrackingRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async withSerializableTransaction<T>(
    operation: (transaction: ProgressTransactionRepository) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.client.$transaction(
          (transaction) => operation(new PrismaProgressTransactionRepository(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (!isSerializationConflict(error) && !isRetryableProgressUniqueConflict(error)) {
          throw error;
        }
        if (attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw new ProgressTransactionConflictError();
        }
      }
    }
    throw new ProgressTransactionConflictError();
  }

  async listOwnActiveEnrollmentIds(
    studentId: string,
    limit: number,
  ): Promise<{ enrollmentIds: string[]; activeCount: number; completedCount: number }> {
    const activeWhere = {
      studentId,
      status: CourseEnrollmentStatus.ACTIVE,
    } satisfies Prisma.CourseEnrollmentWhereInput;
    const completedWhere = {
      studentId,
      status: CourseEnrollmentStatus.COMPLETED,
      progressRoot: {
        is: {
          coursePercentage: 100,
          totalEligibleLessons: { gt: 0 },
        },
      },
    } satisfies Prisma.CourseEnrollmentWhereInput;
    const [active, activeCount, completedCount] = await this.client.$transaction([
      this.client.courseEnrollment.findMany({
        where: activeWhere,
        select: { id: true },
        orderBy: [
          { progressRoot: { lastVisitedAt: 'desc' } },
          { enrolledAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit,
      }),
      this.client.courseEnrollment.count({ where: activeWhere }),
      this.client.courseEnrollment.count({ where: completedWhere }),
    ]);
    return {
      enrollmentIds: active.map((enrollment) => enrollment.id),
      activeCount,
      completedCount,
    };
  }

  async listOwnCompletedEnrollmentIds(
    studentId: string,
    query: CompletedCourseQuery,
  ): Promise<{ enrollmentIds: string[]; total: number }> {
    const where = {
      studentId,
      status: CourseEnrollmentStatus.COMPLETED,
      completedAt: { not: null },
      progressRoot: {
        is: {
          coursePercentage: 100,
          totalEligibleLessons: { gt: 0 },
        },
      },
    } satisfies Prisma.CourseEnrollmentWhereInput;
    const orderBy =
      query.sortBy === 'completedAt'
        ? [{ completedAt: query.sortDirection }, { id: query.sortDirection }]
        : [{ enrolledAt: query.sortDirection }, { id: query.sortDirection }];
    const [records, total] = await this.client.$transaction([
      this.client.courseEnrollment.findMany({
        where,
        select: { id: true },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.courseEnrollment.count({ where }),
    ]);
    return { enrollmentIds: records.map((record) => record.id), total };
  }
}
