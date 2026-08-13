import { CourseEnrollmentStatus, CourseStatus, RoleCode } from '@prisma/client';
import type {
  BlockProgressDto,
  CompletedCourseDto,
  CourseProgressDto,
  CourseProgressSummaryDto,
  LessonProgressDto,
  ProgressActor,
  ProgressAggregate,
  ProgressCapabilitiesDto,
  ProgressEnrollmentRecord,
  ProgressLessonRecord,
  ProgressRootRecord,
  ProgressUnavailableReason,
  ProjectedCourseProgressState,
  ProjectedLessonProgressState,
  ResumeLearningDto,
  SectionProgressDto,
} from './progress-tracking.types.js';

export function calculateProgressAggregate(
  enrollment: ProgressEnrollmentRecord,
): ProgressAggregate {
  const lessons = enrollment.course.sections.flatMap((section) => section.lessons);
  const blocks = lessons.flatMap((lesson) => lesson.blocks);
  const requiredBlocks = blocks.filter((block) => block.isRequired);
  const completedEligibleBlocks = requiredBlocks.filter(
    (block) => block.progress?.state === 'COMPLETED',
  ).length;
  const completedLessons = lessons.filter(
    (lesson) => lesson.progress?.state === 'COMPLETED',
  ).length;
  const totalEligibleLessons = lessons.length;

  return {
    completedEligibleBlocks,
    totalEligibleBlocks: requiredBlocks.length,
    completedLessons,
    totalEligibleLessons,
    coursePercentage:
      totalEligibleLessons === 0 ? 0 : Math.floor((completedLessons * 100) / totalEligibleLessons),
  };
}

export function isCourseAvailable(enrollment: ProgressEnrollmentRecord): boolean {
  const now = new Date();
  return (
    enrollment.course.status === CourseStatus.PUBLISHED &&
    enrollment.course.publishedAt !== null &&
    enrollment.course.deletedAt === null &&
    now >= enrollment.accessStartsAt &&
    now < enrollment.accessExpiresAt
  );
}

function unavailableReason(enrollment: ProgressEnrollmentRecord): ProgressUnavailableReason {
  if (enrollment.status === CourseEnrollmentStatus.SUSPENDED) return 'ENROLLMENT_SUSPENDED';
  if (enrollment.status === CourseEnrollmentStatus.CANCELLED) return 'ENROLLMENT_CANCELLED';
  if (new Date() >= enrollment.accessExpiresAt) return 'ACCESS_EXPIRED';
  if (enrollment.status === CourseEnrollmentStatus.COMPLETED) return 'ENROLLMENT_COMPLETED';
  if (!isCourseAvailable(enrollment)) return 'COURSE_UNAVAILABLE';
  return null;
}

function hasStudentPolicy(actor: ProgressActor, permission: string): boolean {
  return actor.roles.includes(RoleCode.STUDENT) && actor.permissions.includes(permission);
}

export function progressCapabilities(
  enrollment: ProgressEnrollmentRecord,
  actor: ProgressActor,
): ProgressCapabilitiesDto {
  const reason = unavailableReason(enrollment);
  const activeAndAvailable =
    enrollment.status === CourseEnrollmentStatus.ACTIVE && isCourseAvailable(enrollment);
  const completedAndAvailable =
    enrollment.status === CourseEnrollmentStatus.COMPLETED && isCourseAvailable(enrollment);

  return {
    canReadProgress: hasStudentPolicy(actor, 'progress.self_read'),
    canAccessCourseContent: activeAndAvailable || completedAndAvailable,
    canNavigateCurriculum: activeAndAvailable || completedAndAvailable,
    canDownloadPermittedMedia: activeAndAvailable || completedAndAvailable,
    canRecordActivity: activeAndAvailable && hasStudentPolicy(actor, 'progress.self_record_visit'),
    canResumeLearning: activeAndAvailable && hasStudentPolicy(actor, 'progress.self_read'),
    canCompleteBlock: activeAndAvailable && hasStudentPolicy(actor, 'progress.self_complete'),
    canReopenBlock: activeAndAvailable && hasStudentPolicy(actor, 'progress.self_reopen'),
    canCompleteLesson: activeAndAvailable && hasStudentPolicy(actor, 'progress.self_complete'),
    canReopenLesson: activeAndAvailable && hasStudentPolicy(actor, 'progress.self_reopen'),
    unavailableReason: reason,
  };
}

function lessonStatus(lesson: ProgressLessonRecord): ProjectedLessonProgressState {
  if (lesson.progress?.state === 'COMPLETED') return 'COMPLETED';
  const requiredBlocks = lesson.blocks.filter((block) => block.isRequired);
  const allRequiredComplete = requiredBlocks.every(
    (block) => block.progress?.state === 'COMPLETED',
  );
  if (lesson.progress === null && lesson.blocks.every((block) => block.progress === null)) {
    return requiredBlocks.length === 0 ? 'NOT_STARTED' : 'NOT_STARTED';
  }
  return allRequiredComplete ? 'READY_TO_COMPLETE' : 'IN_PROGRESS';
}

function lessonHasMasteryQuiz(lesson: ProgressLessonRecord): boolean {
  return lesson.masteryEnabled === true && lesson.masteryHasQuiz === true;
}

function lessonHasVocabulary(lesson: ProgressLessonRecord): boolean {
  return lesson.vocabularyHasItems === true;
}

function lessonIsUnlocked(lessons: ProgressLessonRecord[], index: number): boolean {
  if (index <= 0) return true;
  const previous = lessons[index - 1];
  if (!previous) return true;
  if (previous.progress?.state === 'COMPLETED') return true;
  return (!lessonHasMasteryQuiz(previous) || (previous.latestQuizPercentage ?? -1) >= (previous.masteryPassingPercentage ?? 75))
    && (!lessonHasVocabulary(previous) || (previous.latestVocabularyPercentage ?? -1) >= 75);
}

function courseState(
  enrollment: ProgressEnrollmentRecord,
  root: ProgressRootRecord,
): ProjectedCourseProgressState {
  if (enrollment.status === CourseEnrollmentStatus.COMPLETED) return 'COMPLETED';
  if (
    root.firstActivityAt ||
    root.lastVisitedAt ||
    root.completedEligibleBlocks > 0 ||
    root.completedLessons > 0
  ) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

function presentBlock(
  block: ProgressLessonRecord['blocks'][number],
  capabilities: ProgressCapabilitiesDto,
  lessonAccessible = true,
): BlockProgressDto {
  const status = block.progress?.state ?? 'NOT_STARTED';
  return {
    id: block.id,
    blockType: block.blockType,
    title: block.title,
    position: block.position,
    isRequired: block.isRequired,
    status,
    completedAt: block.progress?.completedAt?.toISOString() ?? null,
    capabilities: {
      canCompleteBlock: lessonAccessible && capabilities.canCompleteBlock && status !== 'COMPLETED',
      canReopenBlock: lessonAccessible && capabilities.canReopenBlock && status === 'COMPLETED',
      unavailableReason: capabilities.unavailableReason,
    },
  };
}

export function presentLessonProgress(
  lesson: ProgressLessonRecord,
  capabilities: ProgressCapabilitiesDto,
  previousLesson: ProgressLessonRecord | null = null,
): LessonProgressDto {
  const requiredBlocks = lesson.blocks.filter((block) => block.isRequired);
  const completedEligibleBlocks = requiredBlocks.filter(
    (block) => block.progress?.state === 'COMPLETED',
  ).length;
  const status = lessonStatus(lesson);
  const isLessonCompleted = status === 'COMPLETED';
  const percentage = isLessonCompleted
    ? 100
    : requiredBlocks.length === 0
      ? 0
      : Math.floor((completedEligibleBlocks * 100) / requiredBlocks.length);
  const displayCompletedBlocks = isLessonCompleted ? requiredBlocks.length : completedEligibleBlocks;
  const masteryRequired = lessonHasMasteryQuiz(lesson);
  const passingPercentage = lesson.masteryPassingPercentage ?? 75;
  const latestPercentage = lesson.latestQuizPercentage ?? null;
  const vocabularyRequired = lessonHasVocabulary(lesson);
  const latestVocabularyPercentage = lesson.latestVocabularyPercentage ?? null;
  const vocabularyPassed = !vocabularyRequired || (latestVocabularyPercentage !== null && latestVocabularyPercentage >= 75);
  const masteryPassed = (isLessonCompleted || !masteryRequired || (latestPercentage !== null && latestPercentage >= passingPercentage)) && vocabularyPassed;
  const previousCompleted = previousLesson === null || previousLesson.progress?.state === 'COMPLETED';
  const previousTopicPassed = previousLesson === null || previousCompleted || !lessonHasMasteryQuiz(previousLesson) || ((previousLesson.latestQuizPercentage ?? -1) >= (previousLesson.masteryPassingPercentage ?? 75));
  const previousVocabularyPassed = previousLesson === null || previousCompleted || !lessonHasVocabulary(previousLesson) || ((previousLesson.latestVocabularyPercentage ?? -1) >= 75);
  const previousMasteryPassed = previousTopicPassed && previousVocabularyPassed;
  const locked = !previousCompleted && !previousMasteryPassed;
  const lockReason = !locked
    ? null
    : !previousTopicPassed
      ? 'PREVIOUS_MASTERY'
      : !previousVocabularyPassed
        ? 'PREVIOUS_VOCABULARY'
        : 'PREVIOUS_LESSON';

  return {
    id: lesson.id,
    sectionId: lesson.sectionId,
    title: lesson.title,
    slug: lesson.slug,
    position: lesson.position,
    status,
    completedEligibleBlocks: displayCompletedBlocks,
    totalEligibleBlocks: requiredBlocks.length,
    percentage,
    firstActivityAt: lesson.progress?.firstActivityAt.toISOString() ?? null,
    lastActivityAt: lesson.progress?.lastActivityAt.toISOString() ?? null,
    completedAt: lesson.progress?.completedAt?.toISOString() ?? null,
    blocks: lesson.blocks.map((block) => presentBlock(block, capabilities, !locked)),
    mastery: {
      required: masteryRequired,
      passingPercentage,
      latestPercentage,
      passed: masteryPassed,
      vocabularyRequired,
      vocabularyPassingPercentage: 75,
      latestVocabularyPercentage,
      vocabularyPassed,
      locked,
      lockReason,
      previousLessonId: previousLesson?.id ?? null,
      previousLessonTitle: previousLesson?.title ?? null,
      previousPassingPercentage: previousLesson && lessonHasMasteryQuiz(previousLesson)
        ? previousLesson.masteryPassingPercentage ?? 75
        : null,
      previousTopicPercentage: previousLesson?.latestQuizPercentage ?? null,
      previousVocabularyPercentage: previousLesson?.latestVocabularyPercentage ?? null,
      previousVocabularyRequired: previousLesson ? lessonHasVocabulary(previousLesson) : false,
    },
    capabilities: {
      canAccessLesson: capabilities.canAccessCourseContent && !locked,
      canCompleteLesson: capabilities.canCompleteLesson && !locked && masteryPassed && status === 'READY_TO_COMPLETE',
      canReopenLesson: capabilities.canReopenLesson && !locked && status === 'COMPLETED',
      unavailableReason: capabilities.unavailableReason,
    },
  };
}

function presentSection(
  section: ProgressEnrollmentRecord['course']['sections'][number],
  capabilities: ProgressCapabilitiesDto,
  previousLesson: ProgressLessonRecord | null,
): { section: SectionProgressDto; lastLesson: ProgressLessonRecord | null } {
  let previous = previousLesson;
  const lessons = section.lessons.map((lesson) => {
    const projected = presentLessonProgress(lesson, capabilities, previous);
    previous = lesson;
    return projected;
  });
  const completedLessons = lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
  const hasActivity = lessons.some((lesson) => lesson.status !== 'NOT_STARTED');
  const status: ProjectedCourseProgressState =
    lessons.length > 0 && completedLessons === lessons.length
      ? 'COMPLETED'
      : hasActivity
        ? 'IN_PROGRESS'
        : 'NOT_STARTED';

  return {
    section: {
      id: section.id,
      title: section.title,
      position: section.position,
      status,
      completedLessons,
      totalEligibleLessons: lessons.length,
      percentage: lessons.length === 0 ? 0 : Math.floor((completedLessons * 100) / lessons.length),
      lessons,
    },
    lastLesson: previous,
  };
}

function orderedLessons(enrollment: ProgressEnrollmentRecord): ProgressLessonRecord[] {
  return enrollment.course.sections.flatMap((section) => section.lessons);
}

export function presentResumeTarget(
  enrollment: ProgressEnrollmentRecord,
  root: ProgressRootRecord,
): ResumeLearningDto | null {
  if (enrollment.status !== CourseEnrollmentStatus.ACTIVE || !isCourseAvailable(enrollment)) {
    return null;
  }

  const lessons = orderedLessons(enrollment);
  const incomplete = lessons.filter((lesson, index) => lesson.progress?.state !== 'COMPLETED' && lessonIsUnlocked(lessons, index));
  if (incomplete.length === 0) return null;

  let target = incomplete[0];
  if (root.lastVisitedLessonId) {
    const lastIndex = lessons.findIndex((lesson) => lesson.id === root.lastVisitedLessonId);
    const lastLesson = lastIndex >= 0 ? lessons[lastIndex] : undefined;
    if (lastLesson && lastLesson.progress?.state !== 'COMPLETED' && lessonIsUnlocked(lessons, lastIndex)) {
      target = lastLesson;
    } else if (lastIndex >= 0) {
      target =
        lessons.slice(lastIndex + 1).find((lesson, offset) => lesson.progress?.state !== 'COMPLETED' && lessonIsUnlocked(lessons, lastIndex + 1 + offset)) ??
        incomplete[0];
    }
  }
  if (!target) return null;

  const section = enrollment.course.sections.find((candidate) => candidate.id === target.sectionId);
  if (!section) return null;

  return {
    enrollmentId: enrollment.id,
    course: {
      id: enrollment.course.id,
      title: enrollment.course.title,
      slug: enrollment.course.slug,
      level: enrollment.course.level,
    },
    section: {
      id: section.id,
      title: section.title,
      position: section.position,
    },
    lesson: {
      id: target.id,
      title: target.title,
      slug: target.slug,
      position: target.position,
    },
    lastActivityAt: root.lastVisitedAt?.toISOString() ?? null,
    coursePercentage: root.coursePercentage,
    unavailableReason: null,
  };
}

export function presentCourseSummary(
  enrollment: ProgressEnrollmentRecord,
  root: ProgressRootRecord,
  actor: ProgressActor,
): CourseProgressSummaryDto {
  const capabilities = progressCapabilities(enrollment, actor);
  return {
    enrollmentId: enrollment.id,
    course: {
      id: enrollment.course.id,
      title: enrollment.course.title,
      slug: enrollment.course.slug,
      level: enrollment.course.level,
    },
    enrollmentStatus: enrollment.status,
    accessExpiresAt: enrollment.accessExpiresAt.toISOString(),
    accessActive: isCourseAvailable(enrollment),
    daysRemaining: Math.max(0, Math.ceil((enrollment.accessExpiresAt.getTime() - Date.now()) / 86_400_000)),
    status: courseState(enrollment, root),
    curriculumVersion: root.curriculumVersion,
    completionVersion: root.completionVersion,
    activityVersion: root.activityVersion,
    completedLessons: root.completedLessons,
    totalEligibleLessons: root.totalEligibleLessons,
    percentage:
      enrollment.status === CourseEnrollmentStatus.COMPLETED ? 100 : root.coursePercentage,
    firstActivityAt: root.firstActivityAt?.toISOString() ?? null,
    lastActivityAt: root.lastVisitedAt?.toISOString() ?? null,
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    resumeTarget: presentResumeTarget(enrollment, root),
    capabilities,
  };
}

export function presentCourseProgress(
  enrollment: ProgressEnrollmentRecord,
  root: ProgressRootRecord,
  actor: ProgressActor,
  calculatedAt: Date,
): CourseProgressDto {
  const capabilities = progressCapabilities(enrollment, actor);
  let previousLesson: ProgressLessonRecord | null = null;
  const sections = enrollment.course.sections.map((section) => {
    const presented = presentSection(section, capabilities, previousLesson);
    previousLesson = presented.lastLesson;
    return presented.section;
  });
  return {
    ...presentCourseSummary(enrollment, root, actor),
    completedEligibleBlocks: root.completedEligibleBlocks,
    totalEligibleBlocks: root.totalEligibleBlocks,
    sections,
    calculatedAt: calculatedAt.toISOString(),
  };
}

export function presentCompletedCourse(
  enrollment: ProgressEnrollmentRecord,
  root: ProgressRootRecord,
): CompletedCourseDto | null {
  if (
    enrollment.status !== CourseEnrollmentStatus.COMPLETED ||
    !enrollment.completedAt ||
    root.coursePercentage !== 100 ||
    root.totalEligibleLessons < 1
  ) {
    return null;
  }
  return {
    enrollmentId: enrollment.id,
    course: {
      id: enrollment.course.id,
      title: enrollment.course.title,
      slug: enrollment.course.slug,
      level: enrollment.course.level,
    },
    completionCurriculumVersion: root.curriculumVersion,
    percentage: 100,
    completedLessons: root.completedLessons,
    totalEligibleLessons: root.totalEligibleLessons,
    completedAt: enrollment.completedAt.toISOString(),
  };
}
