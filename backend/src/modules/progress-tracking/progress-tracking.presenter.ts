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
  return (
    enrollment.course.status === CourseStatus.PUBLISHED &&
    enrollment.course.publishedAt !== null &&
    enrollment.course.deletedAt === null
  );
}

function unavailableReason(enrollment: ProgressEnrollmentRecord): ProgressUnavailableReason {
  if (enrollment.status === CourseEnrollmentStatus.SUSPENDED) return 'ENROLLMENT_SUSPENDED';
  if (enrollment.status === CourseEnrollmentStatus.CANCELLED) return 'ENROLLMENT_CANCELLED';
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
      canCompleteBlock: capabilities.canCompleteBlock && status !== 'COMPLETED',
      canReopenBlock: capabilities.canReopenBlock && status === 'COMPLETED',
      unavailableReason: capabilities.unavailableReason,
    },
  };
}

export function presentLessonProgress(
  lesson: ProgressLessonRecord,
  capabilities: ProgressCapabilitiesDto,
): LessonProgressDto {
  const requiredBlocks = lesson.blocks.filter((block) => block.isRequired);
  const completedEligibleBlocks = requiredBlocks.filter(
    (block) => block.progress?.state === 'COMPLETED',
  ).length;
  const status = lessonStatus(lesson);
  const percentage =
    requiredBlocks.length === 0
      ? status === 'COMPLETED'
        ? 100
        : 0
      : Math.floor((completedEligibleBlocks * 100) / requiredBlocks.length);

  return {
    id: lesson.id,
    sectionId: lesson.sectionId,
    title: lesson.title,
    slug: lesson.slug,
    position: lesson.position,
    status,
    completedEligibleBlocks,
    totalEligibleBlocks: requiredBlocks.length,
    percentage,
    firstActivityAt: lesson.progress?.firstActivityAt.toISOString() ?? null,
    lastActivityAt: lesson.progress?.lastActivityAt.toISOString() ?? null,
    completedAt: lesson.progress?.completedAt?.toISOString() ?? null,
    blocks: lesson.blocks.map((block) => presentBlock(block, capabilities)),
    capabilities: {
      canCompleteLesson: capabilities.canCompleteLesson && status === 'READY_TO_COMPLETE',
      canReopenLesson: capabilities.canReopenLesson && status === 'COMPLETED',
      unavailableReason: capabilities.unavailableReason,
    },
  };
}

function presentSection(
  section: ProgressEnrollmentRecord['course']['sections'][number],
  capabilities: ProgressCapabilitiesDto,
): SectionProgressDto {
  const lessons = section.lessons.map((lesson) => presentLessonProgress(lesson, capabilities));
  const completedLessons = lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
  const hasActivity = lessons.some((lesson) => lesson.status !== 'NOT_STARTED');
  const status: ProjectedCourseProgressState =
    lessons.length > 0 && completedLessons === lessons.length
      ? 'COMPLETED'
      : hasActivity
        ? 'IN_PROGRESS'
        : 'NOT_STARTED';

  return {
    id: section.id,
    title: section.title,
    position: section.position,
    status,
    completedLessons,
    totalEligibleLessons: lessons.length,
    percentage: lessons.length === 0 ? 0 : Math.floor((completedLessons * 100) / lessons.length),
    lessons,
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
  const incomplete = lessons.filter((lesson) => lesson.progress?.state !== 'COMPLETED');
  if (incomplete.length === 0) return null;

  let target = incomplete[0];
  if (root.lastVisitedLessonId) {
    const lastIndex = lessons.findIndex((lesson) => lesson.id === root.lastVisitedLessonId);
    const lastLesson = lastIndex >= 0 ? lessons[lastIndex] : undefined;
    if (lastLesson && lastLesson.progress?.state !== 'COMPLETED') {
      target = lastLesson;
    } else if (lastIndex >= 0) {
      target =
        lessons.slice(lastIndex + 1).find((lesson) => lesson.progress?.state !== 'COMPLETED') ??
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
    },
    enrollmentStatus: enrollment.status,
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
  return {
    ...presentCourseSummary(enrollment, root, actor),
    completedEligibleBlocks: root.completedEligibleBlocks,
    totalEligibleBlocks: root.totalEligibleBlocks,
    sections: enrollment.course.sections.map((section) => presentSection(section, capabilities)),
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
    },
    completionCurriculumVersion: root.curriculumVersion,
    percentage: 100,
    completedLessons: root.completedLessons,
    totalEligibleLessons: root.totalEligibleLessons,
    completedAt: enrollment.completedAt.toISOString(),
  };
}
