import { createHash } from 'node:crypto';
import {
  BlockProgressState,
  CourseEnrollmentStatus,
  IdempotencyOperation,
  LessonProgressState,
  ProgressEventState,
  ProgressEventType,
  RoleCode,
} from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import { CertificateEligibilityCompletionEvaluator } from '../certificate-eligibility/certificate-eligibility.completion.js';
import {
  calculateProgressAggregate,
  isCourseAvailable,
  presentCompletedCourse,
  presentCourseProgress,
  presentCourseSummary,
  presentLessonProgress,
  presentResumeTarget,
  progressCapabilities,
} from './progress-tracking.presenter.js';
import {
  ProgressTransactionConflictError,
  type ProgressTrackingRepository,
  type ProgressTransactionRepository,
} from './progress-tracking.repository.js';
import type {
  ActivityMutationResultDto,
  CompletedCoursePageDto,
  CompletedCourseQuery,
  CompletionMutationInput,
  CourseProgressDto,
  LastVisitedMutationInput,
  MutationExecution,
  ProgressActor,
  ProgressAggregate,
  ProgressEnrollmentRecord,
  ProgressEventData,
  ProgressMutationResultDto,
  ProgressRequestContext,
  ProgressRootRecord,
  StudentProgressSummaryDto,
  SuccessEnvelope,
} from './progress-tracking.types.js';

const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;

function accessDenied(): AppError {
  return new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

function enrollmentNotFound(): AppError {
  return new AppError('Enrollment topilmadi.', 404, 'ENROLLMENT_NOT_FOUND');
}

function lessonNotFound(): AppError {
  return new AppError('Dars topilmadi.', 404, 'LESSON_NOT_FOUND');
}

function blockNotFound(): AppError {
  return new AppError('Dars materiali topilmadi.', 404, 'CONTENT_BLOCK_NOT_FOUND');
}

function assertSelfPolicy(actor: ProgressActor, permission: string): void {
  if (!actor.roles.includes(RoleCode.STUDENT) || !actor.permissions.includes(permission)) {
    throw accessDenied();
  }
}

function assertOwnership(enrollment: ProgressEnrollmentRecord, actor: ProgressActor): void {
  if (enrollment.studentId !== actor.userId) throw enrollmentNotFound();
}

function assertActiveEnrollment(enrollment: ProgressEnrollmentRecord): void {
  if (enrollment.status === CourseEnrollmentStatus.SUSPENDED) {
    throw new AppError('O‘qish jarayoni vaqtincha to‘xtatilgan.', 409, 'ENROLLMENT_SUSPENDED');
  }
  if (enrollment.status === CourseEnrollmentStatus.CANCELLED) {
    throw new AppError(
      'Kursdan chiqilgan. Jarayonni o‘zgartirib bo‘lmaydi.',
      409,
      'ENROLLMENT_CANCELLED',
    );
  }
  if (enrollment.status === CourseEnrollmentStatus.COMPLETED) {
    throw new AppError(
      'Kurs yakunlangan. Jarayonni o‘zgartirib bo‘lmaydi.',
      409,
      'ENROLLMENT_COMPLETED',
    );
  }
  if (enrollment.status !== CourseEnrollmentStatus.ACTIVE) {
    throw new AppError(
      'O‘qish jarayonini o‘zgartirish uchun enrollment faol bo‘lishi kerak.',
      409,
      'ENROLLMENT_NOT_ACTIVE',
    );
  }
}

function assertCourseAvailable(enrollment: ProgressEnrollmentRecord): void {
  if (!isCourseAvailable(enrollment)) {
    throw new AppError('Kurs hozir o‘qish uchun mavjud emas.', 409, 'COURSE_UNAVAILABLE');
  }
}

function assertCurriculumVersion(
  enrollment: ProgressEnrollmentRecord,
  curriculumVersion: number,
): void {
  if (enrollment.course.curriculumVersion !== curriculumVersion) {
    throw new AppError(
      'Kurs tarkibi yangilandi. Jarayonni qayta yuklang.',
      409,
      'CURRICULUM_VERSION_CONFLICT',
    );
  }
}

function assertCompletionVersion(root: ProgressRootRecord, expectedVersion: number): void {
  if (root.completionVersion !== expectedVersion) {
    throw new AppError(
      'O‘qish jarayoni boshqa qurilmada yangilangan. Ma’lumotlarni qayta yuklang.',
      409,
      'COMPLETION_VERSION_CONFLICT',
    );
  }
}

function aggregateChanged(root: ProgressRootRecord, aggregate: ProgressAggregate): boolean {
  return (
    root.completedEligibleBlocks !== aggregate.completedEligibleBlocks ||
    root.totalEligibleBlocks !== aggregate.totalEligibleBlocks ||
    root.completedLessons !== aggregate.completedLessons ||
    root.totalEligibleLessons !== aggregate.totalEligibleLessons ||
    root.coursePercentage !== aggregate.coursePercentage
  );
}

function syntheticTerminalRoot(enrollment: ProgressEnrollmentRecord): ProgressRootRecord {
  const now = enrollment.completedAt ?? enrollment.cancelledAt ?? enrollment.enrolledAt;
  return {
    id: enrollment.id,
    enrollmentId: enrollment.id,
    lastVisitedLessonId: null,
    lastVisitedAt: null,
    firstActivityAt: null,
    completionVersion: 0,
    activityVersion: 0,
    curriculumVersion: enrollment.course.curriculumVersion,
    completedEligibleBlocks: 0,
    totalEligibleBlocks: 0,
    completedLessons: 0,
    totalEligibleLessons: 0,
    coursePercentage: enrollment.status === CourseEnrollmentStatus.COMPLETED ? 100 : 0,
    frozenAt: now,
    createdAt: enrollment.enrolledAt,
    updatedAt: now,
  };
}

function fingerprint(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isSuccessEnvelope<T>(value: unknown): value is SuccessEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { success?: unknown }).success === true &&
    typeof (value as { message?: unknown }).message === 'string' &&
    'data' in value
  );
}

function idempotencyConflict(): AppError {
  return new AppError(
    'Takroriy so‘rov kaliti boshqa amal uchun ishlatilgan.',
    409,
    'IDEMPOTENCY_KEY_CONFLICT',
  );
}

interface LoadedProgress {
  enrollment: ProgressEnrollmentRecord;
  root: ProgressRootRecord;
}

export interface ProgressTrackingUseCases {
  getOwnSummary(activeLimit: number, actor: ProgressActor): Promise<StudentProgressSummaryDto>;
  listOwnCompleted(
    query: CompletedCourseQuery,
    actor: ProgressActor,
  ): Promise<CompletedCoursePageDto>;
  getOwnEnrollmentProgress(enrollmentId: string, actor: ProgressActor): Promise<CourseProgressDto>;
  getOwnResumeTarget(
    enrollmentId: string,
    actor: ProgressActor,
  ): Promise<ReturnType<typeof presentResumeTarget>>;
  completeBlock(
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>>;
  reopenBlock(
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>>;
  completeLesson(
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>>;
  reopenLesson(
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>>;
  recordLastVisitedLesson(
    enrollmentId: string,
    input: LastVisitedMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ActivityMutationResultDto>>;
}

export class ProgressTrackingService implements ProgressTrackingUseCases {
  constructor(
    private readonly repository: ProgressTrackingRepository,
    private readonly eligibilityEvaluator = new CertificateEligibilityCompletionEvaluator(),
  ) {}

  async getOwnSummary(
    activeLimit: number,
    actor: ProgressActor,
  ): Promise<StudentProgressSummaryDto> {
    assertSelfPolicy(actor, 'progress.self_read');
    const listing = await this.repository.listOwnActiveEnrollmentIds(actor.userId, activeLimit);
    const loaded = await Promise.all(
      listing.enrollmentIds.map((enrollmentId) => this.loadOwnedProgress(enrollmentId, actor)),
    );
    loaded.sort((left, right) => {
      const leftVisit = left.root.lastVisitedAt?.getTime();
      const rightVisit = right.root.lastVisitedAt?.getTime();
      if (leftVisit !== undefined || rightVisit !== undefined) {
        if (leftVisit === undefined) return 1;
        if (rightVisit === undefined) return -1;
        if (leftVisit !== rightVisit) return rightVisit - leftVisit;
      }
      const enrolled = left.enrollment.enrolledAt.getTime() - right.enrollment.enrolledAt.getTime();
      return enrolled || left.enrollment.course.id.localeCompare(right.enrollment.course.id);
    });
    const summaries = loaded.map(({ enrollment, root }) =>
      presentCourseSummary(enrollment, root, actor),
    );
    const resumeLearning =
      loaded
        .map(({ enrollment, root }) => presentResumeTarget(enrollment, root))
        .find((target) => target !== null) ?? null;
    return {
      generatedAt: new Date().toISOString(),
      resumeLearning,
      activeCourseCount: listing.activeCount,
      completedCourseCount: listing.completedCount,
      activeCourses: summaries,
    };
  }

  async listOwnCompleted(
    query: CompletedCourseQuery,
    actor: ProgressActor,
  ): Promise<CompletedCoursePageDto> {
    assertSelfPolicy(actor, 'progress.self_read');
    const listing = await this.repository.listOwnCompletedEnrollmentIds(actor.userId, query);
    const loaded = await Promise.all(
      listing.enrollmentIds.map((enrollmentId) => this.loadOwnedProgress(enrollmentId, actor)),
    );
    const items = loaded.flatMap(({ enrollment, root }) => {
      const item = presentCompletedCourse(enrollment, root);
      return item ? [item] : [];
    });
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: listing.total,
        totalPages: Math.ceil(listing.total / query.pageSize),
      },
    };
  }

  async getOwnEnrollmentProgress(
    enrollmentId: string,
    actor: ProgressActor,
  ): Promise<CourseProgressDto> {
    assertSelfPolicy(actor, 'progress.self_read');
    const { enrollment, root } = await this.loadOwnedProgress(enrollmentId, actor);
    return presentCourseProgress(enrollment, root, actor, new Date());
  }

  async getOwnResumeTarget(
    enrollmentId: string,
    actor: ProgressActor,
  ): Promise<ReturnType<typeof presentResumeTarget>> {
    assertSelfPolicy(actor, 'progress.self_read');
    const { enrollment, root } = await this.loadOwnedProgress(enrollmentId, actor);
    return presentResumeTarget(enrollment, root);
  }

  async completeBlock(
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>> {
    assertSelfPolicy(actor, 'progress.self_complete');
    return this.mutateBlock(
      IdempotencyOperation.COMPLETE_BLOCK,
      enrollmentId,
      blockId,
      input,
      actor,
      context,
    );
  }

  async reopenBlock(
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>> {
    assertSelfPolicy(actor, 'progress.self_reopen');
    return this.mutateBlock(
      IdempotencyOperation.REOPEN_BLOCK,
      enrollmentId,
      blockId,
      input,
      actor,
      context,
    );
  }

  async completeLesson(
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>> {
    assertSelfPolicy(actor, 'progress.self_complete');
    return this.mutateLesson(
      IdempotencyOperation.COMPLETE_LESSON,
      enrollmentId,
      lessonId,
      input,
      actor,
      context,
    );
  }

  async reopenLesson(
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>> {
    assertSelfPolicy(actor, 'progress.self_reopen');
    return this.mutateLesson(
      IdempotencyOperation.REOPEN_LESSON,
      enrollmentId,
      lessonId,
      input,
      actor,
      context,
    );
  }

  async recordLastVisitedLesson(
    enrollmentId: string,
    input: LastVisitedMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ActivityMutationResultDto>> {
    assertSelfPolicy(actor, 'progress.self_record_visit');
    const requestFingerprint = fingerprint({
      apiVersion: 'v1',
      operation: IdempotencyOperation.RECORD_LAST_VISITED_LESSON,
      actorId: actor.userId,
      enrollmentId,
      lessonId: input.lessonId,
      curriculumVersion: input.curriculumVersion,
    });
    return this.runTransaction(async (transaction) => {
      const loaded = await this.loadForMutation(transaction, enrollmentId, actor);
      const replay = await this.replay<ActivityMutationResultDto>(
        transaction,
        actor.userId,
        context.idempotencyKey,
        requestFingerprint,
      );
      if (replay) return replay;
      assertActiveEnrollment(loaded.enrollment);
      assertCourseAvailable(loaded.enrollment);
      assertCurriculumVersion(loaded.enrollment, input.curriculumVersion);

      const lesson = loaded.enrollment.course.sections
        .flatMap((section) => section.lessons)
        .find((candidate) => candidate.id === input.lessonId);
      if (!lesson) throw lessonNotFound();

      const occurredAt = await transaction.getDatabaseTimestamp();
      await transaction.lockLessonProgress(enrollmentId, lesson.id);
      await transaction.upsertLessonActivity(
        enrollmentId,
        lesson.id,
        input.curriculumVersion,
        occurredAt,
      );
      const updatedRoot = await transaction.updateProgressRoot(enrollmentId, {
        activityVersion: loaded.root.activityVersion + 1,
        firstActivityAt: loaded.root.firstActivityAt ?? occurredAt,
        lastVisitedLessonId: lesson.id,
        lastVisitedAt: occurredAt,
      });
      const refreshed = await transaction.findEnrollment(enrollmentId);
      if (!refreshed) throw enrollmentNotFound();
      refreshed.root = updatedRoot;
      const result: ActivityMutationResultDto = {
        enrollmentId,
        curriculumVersion: updatedRoot.curriculumVersion,
        completionVersion: updatedRoot.completionVersion,
        activityVersion: updatedRoot.activityVersion,
        changed: true,
        lastVisitedLessonId: lesson.id,
        lastVisitedAt: occurredAt.toISOString(),
        resumeTarget: presentResumeTarget(refreshed, updatedRoot),
      };
      const envelope: SuccessEnvelope<ActivityMutationResultDto> = {
        success: true,
        message: 'Oxirgi ko‘rilgan dars yangilandi.',
        data: result,
      };
      await transaction.createIdempotencyRecord({
        actorUserId: actor.userId,
        enrollmentId,
        key: context.idempotencyKey,
        operation: IdempotencyOperation.RECORD_LAST_VISITED_LESSON,
        requestFingerprint,
        responseEnvelope: envelope,
        resultingActivityVersion: updatedRoot.activityVersion,
        expiresAt: new Date(occurredAt.getTime() + IDEMPOTENCY_RETENTION_MS),
      });
      return { envelope, replayed: false };
    });
  }

  private async mutateBlock(
    operation:
      typeof IdempotencyOperation.COMPLETE_BLOCK | typeof IdempotencyOperation.REOPEN_BLOCK,
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>> {
    const requestFingerprint = fingerprint({
      apiVersion: 'v1',
      operation,
      actorId: actor.userId,
      enrollmentId,
      blockId,
      expectedCompletionVersion: input.expectedCompletionVersion,
      curriculumVersion: input.curriculumVersion,
    });
    return this.runTransaction(async (transaction) => {
      const loaded = await this.loadForMutation(transaction, enrollmentId, actor);
      const replay = await this.replay<ProgressMutationResultDto>(
        transaction,
        actor.userId,
        context.idempotencyKey,
        requestFingerprint,
      );
      if (replay) return replay;
      this.assertCompletionMutationEligibility(loaded, input);

      const lesson = loaded.enrollment.course.sections
        .flatMap((section) => section.lessons)
        .find((candidate) => candidate.blocks.some((block) => block.id === blockId));
      const block = lesson?.blocks.find((candidate) => candidate.id === blockId);
      if (!lesson || !block) throw blockNotFound();

      await transaction.lockLessonProgress(enrollmentId, lesson.id);
      await transaction.lockBlockProgress(enrollmentId, block.id);
      const previousState = block.progress?.state ?? 'NOT_STARTED';
      const isComplete = operation === IdempotencyOperation.COMPLETE_BLOCK;
      if (
        !isComplete &&
        lesson.progress?.state === LessonProgressState.COMPLETED &&
        previousState === BlockProgressState.COMPLETED
      ) {
        throw new AppError(
          'Avval yakunlangan darsni qayta oching.',
          409,
          'INVALID_PROGRESS_TRANSITION',
        );
      }
      if (!isComplete && previousState === 'NOT_STARTED') {
        throw new AppError(
          'O‘qish jarayoni uchun bu o‘tish mumkin emas.',
          409,
          'INVALID_PROGRESS_TRANSITION',
        );
      }
      const changed = isComplete
        ? previousState !== BlockProgressState.COMPLETED
        : previousState === BlockProgressState.COMPLETED;
      const occurredAt = await transaction.getDatabaseTimestamp();
      if (changed) {
        await transaction.setBlockState(
          enrollmentId,
          block.id,
          isComplete ? BlockProgressState.COMPLETED : BlockProgressState.INCOMPLETE,
          input.curriculumVersion,
          occurredAt,
        );
        await transaction.upsertLessonActivity(
          enrollmentId,
          lesson.id,
          input.curriculumVersion,
          occurredAt,
        );
      }
      return this.finishCompletionMutation({
        transaction,
        loaded,
        actor,
        context,
        operation,
        requestFingerprint,
        affectedLessonId: lesson.id,
        changed,
        occurredAt,
        event: changed
          ? {
              eventType: isComplete
                ? ProgressEventType.BLOCK_COMPLETED
                : ProgressEventType.BLOCK_REOPENED,
              lessonId: lesson.id,
              blockId: block.id,
              previousState:
                previousState === 'NOT_STARTED'
                  ? ProgressEventState.NOT_STARTED
                  : previousState === BlockProgressState.COMPLETED
                    ? ProgressEventState.COMPLETED
                    : ProgressEventState.INCOMPLETE,
              newState: isComplete ? ProgressEventState.COMPLETED : ProgressEventState.INCOMPLETE,
            }
          : null,
      });
    });
  }

  private async mutateLesson(
    operation:
      typeof IdempotencyOperation.COMPLETE_LESSON | typeof IdempotencyOperation.REOPEN_LESSON,
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    actor: ProgressActor,
    context: ProgressRequestContext,
  ): Promise<MutationExecution<ProgressMutationResultDto>> {
    const requestFingerprint = fingerprint({
      apiVersion: 'v1',
      operation,
      actorId: actor.userId,
      enrollmentId,
      lessonId,
      expectedCompletionVersion: input.expectedCompletionVersion,
      curriculumVersion: input.curriculumVersion,
    });
    return this.runTransaction(async (transaction) => {
      const loaded = await this.loadForMutation(transaction, enrollmentId, actor);
      const replay = await this.replay<ProgressMutationResultDto>(
        transaction,
        actor.userId,
        context.idempotencyKey,
        requestFingerprint,
      );
      if (replay) return replay;
      this.assertCompletionMutationEligibility(loaded, input);
      const lesson = loaded.enrollment.course.sections
        .flatMap((section) => section.lessons)
        .find((candidate) => candidate.id === lessonId);
      if (!lesson) throw lessonNotFound();

      await transaction.lockLessonProgress(enrollmentId, lesson.id);
      const isComplete = operation === IdempotencyOperation.COMPLETE_LESSON;
      const previousState = lesson.progress?.state ?? 'NOT_STARTED';
      if (
        isComplete &&
        previousState !== LessonProgressState.COMPLETED &&
        lesson.blocks
          .filter((block) => block.isRequired)
          .some((block) => block.progress?.state !== BlockProgressState.COMPLETED)
      ) {
        throw new AppError(
          'Darsni tugallash uchun majburiy materiallarni yakunlang.',
          409,
          'LESSON_COMPLETION_REQUIREMENTS_NOT_MET',
        );
      }
      if (!isComplete && previousState === 'NOT_STARTED') {
        throw new AppError(
          'O‘qish jarayoni uchun bu o‘tish mumkin emas.',
          409,
          'INVALID_PROGRESS_TRANSITION',
        );
      }
      const changed = isComplete
        ? previousState !== LessonProgressState.COMPLETED
        : previousState === LessonProgressState.COMPLETED;
      const occurredAt = await transaction.getDatabaseTimestamp();
      if (changed) {
        await transaction.setLessonState(
          enrollmentId,
          lesson.id,
          isComplete ? LessonProgressState.COMPLETED : LessonProgressState.IN_PROGRESS,
          input.curriculumVersion,
          occurredAt,
        );
      }
      return this.finishCompletionMutation({
        transaction,
        loaded,
        actor,
        context,
        operation,
        requestFingerprint,
        affectedLessonId: lesson.id,
        changed,
        occurredAt,
        event: changed
          ? {
              eventType: isComplete
                ? ProgressEventType.LESSON_COMPLETED
                : ProgressEventType.LESSON_REOPENED,
              lessonId: lesson.id,
              blockId: null,
              previousState:
                previousState === 'NOT_STARTED'
                  ? ProgressEventState.NOT_STARTED
                  : previousState === LessonProgressState.COMPLETED
                    ? ProgressEventState.COMPLETED
                    : ProgressEventState.IN_PROGRESS,
              newState: isComplete ? ProgressEventState.COMPLETED : ProgressEventState.IN_PROGRESS,
            }
          : null,
        allowCourseCompletion: isComplete,
      });
    });
  }

  private async finishCompletionMutation(options: {
    transaction: ProgressTransactionRepository;
    loaded: LoadedProgress;
    actor: ProgressActor;
    context: ProgressRequestContext;
    operation: Exclude<IdempotencyOperation, 'RECORD_LAST_VISITED_LESSON'>;
    requestFingerprint: string;
    affectedLessonId: string;
    changed: boolean;
    occurredAt: Date;
    event: Pick<
      ProgressEventData,
      'eventType' | 'lessonId' | 'blockId' | 'previousState' | 'newState'
    > | null;
    allowCourseCompletion?: boolean;
  }): Promise<MutationExecution<ProgressMutationResultDto>> {
    const {
      transaction,
      loaded,
      actor,
      context,
      operation,
      requestFingerprint,
      affectedLessonId,
      changed,
      occurredAt,
      event,
      allowCourseCompletion = false,
    } = options;
    let refreshed = await transaction.findEnrollment(loaded.enrollment.id);
    if (!refreshed) throw enrollmentNotFound();
    const aggregate = calculateProgressAggregate(refreshed);
    const completionVersion = loaded.root.completionVersion + (changed ? 1 : 0);
    const courseCompletes =
      changed &&
      allowCourseCompletion &&
      aggregate.totalEligibleLessons > 0 &&
      aggregate.completedLessons === aggregate.totalEligibleLessons;
    if (courseCompletes) {
      aggregate.coursePercentage = 100;
      await transaction.completeEnrollment(loaded.enrollment.id, occurredAt);
    }
    const updatedRoot = await transaction.updateProgressRoot(loaded.enrollment.id, {
      aggregate,
      curriculumVersion: refreshed.course.curriculumVersion,
      completionVersion,
      ...(changed && !loaded.root.firstActivityAt ? { firstActivityAt: occurredAt } : {}),
      ...(changed
        ? {
            lastVisitedLessonId: affectedLessonId,
            lastVisitedAt: occurredAt,
          }
        : {}),
      ...(courseCompletes ? { frozenAt: occurredAt } : {}),
    });
    refreshed = await transaction.findEnrollment(loaded.enrollment.id);
    if (!refreshed) throw enrollmentNotFound();
    refreshed.root = updatedRoot;
    const affectedLesson = refreshed.course.sections
      .flatMap((section) => section.lessons)
      .find((lesson) => lesson.id === affectedLessonId);
    if (!affectedLesson) throw lessonNotFound();
    const capabilities = progressCapabilities(refreshed, actor);
    const resumeTarget = presentResumeTarget(refreshed, updatedRoot);
    const result: ProgressMutationResultDto = {
      enrollmentId: refreshed.id,
      curriculumVersion: updatedRoot.curriculumVersion,
      completionVersion: updatedRoot.completionVersion,
      activityVersion: updatedRoot.activityVersion,
      changed,
      affectedLesson: presentLessonProgress(affectedLesson, capabilities),
      course: presentCourseSummary(refreshed, updatedRoot, actor),
      resumeTarget,
    };
    const envelope: SuccessEnvelope<ProgressMutationResultDto> = {
      success: true,
      message: changed ? 'O‘qish jarayoni yangilandi.' : 'O‘qish jarayoni allaqachon shu holatda.',
      data: result,
    };
    const idempotency = await transaction.createIdempotencyRecord({
      actorUserId: actor.userId,
      enrollmentId: refreshed.id,
      key: context.idempotencyKey,
      operation,
      requestFingerprint,
      responseEnvelope: envelope,
      resultingCompletionVersion: updatedRoot.completionVersion,
      expiresAt: new Date(occurredAt.getTime() + IDEMPOTENCY_RETENTION_MS),
    });
    if (event) {
      await transaction.createProgressEvent({
        enrollmentId: refreshed.id,
        actorUserId: actor.userId,
        ...event,
        curriculumVersion: updatedRoot.curriculumVersion,
        resultingCompletionVersion: updatedRoot.completionVersion,
        idempotencyRecordId: idempotency.id,
        occurredAt,
        ...(context.requestCorrelationId
          ? { requestCorrelationId: context.requestCorrelationId }
          : {}),
      });
    }
    if (courseCompletes) {
      await transaction.createProgressEvent({
        enrollmentId: refreshed.id,
        actorUserId: actor.userId,
        eventType: ProgressEventType.COURSE_COMPLETED,
        lessonId: null,
        blockId: null,
        previousState:
          loaded.root.firstActivityAt || loaded.root.completedLessons > 0
            ? ProgressEventState.IN_PROGRESS
            : ProgressEventState.NOT_STARTED,
        newState: ProgressEventState.COMPLETED,
        curriculumVersion: updatedRoot.curriculumVersion,
        resultingCompletionVersion: updatedRoot.completionVersion,
        idempotencyRecordId: idempotency.id,
        occurredAt,
        ...(context.requestCorrelationId
          ? { requestCorrelationId: context.requestCorrelationId }
          : {}),
        snapshot: aggregate,
      });
      await this.eligibilityEvaluator.evaluate(transaction, {
        enrollmentId: refreshed.id,
        courseId: refreshed.course.id,
        completedAt: occurredAt,
        completionCurriculumVersion: updatedRoot.curriculumVersion,
        completionVersion: updatedRoot.completionVersion,
        completedLessons: aggregate.completedLessons,
        totalEligibleLessons: aggregate.totalEligibleLessons,
        coursePercentage: aggregate.coursePercentage,
        completedEligibleBlocks: aggregate.completedEligibleBlocks,
        totalEligibleBlocks: aggregate.totalEligibleBlocks,
      });
    }
    return { envelope, replayed: false };
  }

  private assertCompletionMutationEligibility(
    loaded: LoadedProgress,
    input: CompletionMutationInput,
  ): void {
    assertActiveEnrollment(loaded.enrollment);
    assertCourseAvailable(loaded.enrollment);
    assertCurriculumVersion(loaded.enrollment, input.curriculumVersion);
    assertCompletionVersion(loaded.root, input.expectedCompletionVersion);
  }

  private async replay<T>(
    transaction: ProgressTransactionRepository,
    actorUserId: string,
    key: string,
    requestFingerprint: string,
  ): Promise<MutationExecution<T> | null> {
    const record = await transaction.findIdempotencyRecord(actorUserId, key);
    if (!record) return null;
    if (record.requestFingerprint !== requestFingerprint) throw idempotencyConflict();
    if (!isSuccessEnvelope<T>(record.responseEnvelope)) {
      throw new Error('Stored idempotency response does not match the success envelope contract.');
    }
    return { envelope: record.responseEnvelope, replayed: true };
  }

  private async loadOwnedProgress(
    enrollmentId: string,
    actor: ProgressActor,
  ): Promise<LoadedProgress> {
    return this.runTransaction((transaction) =>
      this.loadLockedProgress(transaction, enrollmentId, actor, false),
    );
  }

  private async loadForMutation(
    transaction: ProgressTransactionRepository,
    enrollmentId: string,
    actor: ProgressActor,
  ): Promise<LoadedProgress> {
    return this.loadLockedProgress(transaction, enrollmentId, actor, true);
  }

  private async loadLockedProgress(
    transaction: ProgressTransactionRepository,
    enrollmentId: string,
    actor: ProgressActor,
    forMutation: boolean,
  ): Promise<LoadedProgress> {
    await transaction.lockEnrollment(enrollmentId);
    let enrollment = await transaction.findEnrollment(enrollmentId);
    if (!enrollment) throw enrollmentNotFound();
    assertOwnership(enrollment, actor);
    await transaction.lockCourse(enrollment.course.id);
    enrollment = await transaction.findEnrollment(enrollmentId);
    if (!enrollment) throw enrollmentNotFound();
    assertOwnership(enrollment, actor);

    if (
      enrollment.status === CourseEnrollmentStatus.CANCELLED ||
      enrollment.status === CourseEnrollmentStatus.COMPLETED
    ) {
      return { enrollment, root: enrollment.root ?? syntheticTerminalRoot(enrollment) };
    }

    const ensured = await transaction.ensureProgressRoot(
      enrollment.id,
      enrollment.course.curriculumVersion,
    );
    await transaction.lockProgressRoot(enrollment.id);
    enrollment = await transaction.findEnrollment(enrollmentId);
    if (!enrollment) throw enrollmentNotFound();
    const aggregate = calculateProgressAggregate(enrollment);
    const shouldUpdate =
      ensured.created ||
      ensured.root.curriculumVersion !== enrollment.course.curriculumVersion ||
      aggregateChanged(ensured.root, aggregate);
    let root = ensured.root;
    if (shouldUpdate) {
      const incrementsCompletion = !ensured.created && aggregateChanged(ensured.root, aggregate);
      root = await transaction.updateProgressRoot(enrollment.id, {
        aggregate,
        curriculumVersion: enrollment.course.curriculumVersion,
        completionVersion: ensured.root.completionVersion + (incrementsCompletion ? 1 : 0),
      });
      enrollment.root = root;
    }
    if (forMutation && root.frozenAt) {
      throw new AppError(
        'O‘qish jarayoni uchun bu o‘tish mumkin emas.',
        409,
        'INVALID_PROGRESS_TRANSITION',
      );
    }
    return { enrollment, root };
  }

  private async runTransaction<T>(
    operation: (transaction: ProgressTransactionRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.repository.withSerializableTransaction(operation);
    } catch (error: unknown) {
      if (error instanceof ProgressTransactionConflictError) {
        throw new AppError(
          'O‘qish jarayoni parallel so‘rov sabab yangilanmadi. Qayta urinib ko‘ring.',
          409,
          'COMPLETION_VERSION_CONFLICT',
        );
      }
      throw error;
    }
  }
}
