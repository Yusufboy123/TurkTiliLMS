import {
  BlockProgressState,
  CourseStatus,
  LessonProgressState,
  LessonStatus,
  type Prisma,
} from '@prisma/client';

export async function bumpPublishedCourseCurriculumVersion(
  transaction: Prisma.TransactionClient,
  courseId: string,
): Promise<boolean> {
  const result = await transaction.course.updateMany({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
      publishedAt: { not: null },
      deletedAt: null,
    },
    data: { curriculumVersion: { increment: 1 } },
  });
  return result.count === 1;
}

export async function isLessonInPublishedCurriculum(
  transaction: Prisma.TransactionClient,
  lessonId: string,
): Promise<boolean> {
  const lesson = await transaction.lesson.findFirst({
    where: {
      id: lessonId,
      status: LessonStatus.PUBLISHED,
      deletedAt: null,
      section: { isPublished: true, deletedAt: null },
      course: {
        status: CourseStatus.PUBLISHED,
        publishedAt: { not: null },
        deletedAt: null,
      },
    },
    select: { id: true },
  });
  return lesson !== null;
}

export async function freezeExistingProgressSnapshot(
  transaction: Prisma.TransactionClient,
  enrollmentId: string,
  frozenAt: Date,
): Promise<void> {
  const root = await transaction.enrollmentProgressRoot.findUnique({
    where: { enrollmentId },
  });
  const enrollment = await transaction.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { courseId: true, course: { select: { curriculumVersion: true } } },
  });
  if (!enrollment) return;

  const eligibleLesson = {
    courseId: enrollment.courseId,
    status: LessonStatus.PUBLISHED,
    deletedAt: null,
    section: { isPublished: true, deletedAt: null },
  } satisfies Prisma.LessonWhereInput;
  const eligibleBlock = {
    isRequired: true,
    isVisible: true,
    deletedAt: null,
    lesson: eligibleLesson,
  } satisfies Prisma.LessonContentBlockWhereInput;
  const [totalEligibleLessons, completedLessons, totalEligibleBlocks, completedEligibleBlocks] =
    await Promise.all([
      transaction.lesson.count({ where: eligibleLesson }),
      transaction.lessonProgress.count({
        where: {
          enrollmentId,
          state: LessonProgressState.COMPLETED,
          lesson: eligibleLesson,
        },
      }),
      transaction.lessonContentBlock.count({ where: eligibleBlock }),
      transaction.blockProgress.count({
        where: {
          enrollmentId,
          state: BlockProgressState.COMPLETED,
          block: eligibleBlock,
        },
      }),
    ]);
  const coursePercentage =
    totalEligibleLessons === 0 ? 0 : Math.floor((completedLessons * 100) / totalEligibleLessons);
  const aggregateChanged =
    root !== null &&
    (root.completedEligibleBlocks !== completedEligibleBlocks ||
      root.totalEligibleBlocks !== totalEligibleBlocks ||
      root.completedLessons !== completedLessons ||
      root.totalEligibleLessons !== totalEligibleLessons ||
      root.coursePercentage !== coursePercentage);

  await transaction.enrollmentProgressRoot.upsert({
    where: { enrollmentId },
    create: {
      enrollmentId,
      curriculumVersion: enrollment.course.curriculumVersion,
      completedEligibleBlocks,
      totalEligibleBlocks,
      completedLessons,
      totalEligibleLessons,
      coursePercentage,
      frozenAt,
    },
    update: {
      curriculumVersion: enrollment.course.curriculumVersion,
      completedEligibleBlocks,
      totalEligibleBlocks,
      completedLessons,
      totalEligibleLessons,
      coursePercentage,
      completionVersion: (root?.completionVersion ?? 0) + (aggregateChanged ? 1 : 0),
      frozenAt,
    },
  });
}
