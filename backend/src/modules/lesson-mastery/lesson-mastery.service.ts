import { CourseEnrollmentStatus, LessonProgressState, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { LessonMasteryAccess, LessonMasteryDecision } from './lesson-mastery.types.js';

const lessonAccessSelect = {
  id: true,
  title: true,
  sectionId: true,
  position: true,
  isPreview: true,
  masteryEnabled: true,
  masteryPassingPercentage: true,
  vocabulary: { where: { deletedAt: null }, take: 1, select: { id: true } },
  quizQuestions: {
    where: { deletedAt: null },
    take: 1,
    select: { id: true },
  },
  progress: {
    select: { state: true },
  },
  quizAttempts: {
    where: { status: 'SUBMITTED' },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { percentage: true },
  },
  vocabularyTestAttempts: {
    where: { status: 'SUBMITTED' },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { percentage: true },
  },
} as const;

export type AccessLesson = {
  id: string;
  title: string;
  sectionId: string;
  position: number;
  isPreview: boolean;
  masteryEnabled: boolean;
  masteryPassingPercentage: number;
  quizQuestions: Array<{ id: string }>;
  progress: Array<{ state: LessonProgressState }>;
  quizAttempts: Array<{ percentage: number }>;
  vocabulary?: Array<{ id: string }>;
  vocabularyTestAttempts?: Array<{ percentage: number }>;
};

export function decisionFor(lessons: AccessLesson[], lessonId: string): LessonMasteryDecision {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) {
    return {
      allowed: false,
      lessonId,
      previousLessonId: null,
      previousLessonTitle: null,
      lockReason: 'PREVIOUS_LESSON',
      requiredPercentage: null,
      previousPercentage: null,
    };
  }
  const previous = index > 0 ? lessons[index - 1] : null;
  if (!previous) {
    return { allowed: true, lessonId, previousLessonId: null, previousLessonTitle: null, lockReason: null, requiredPercentage: null, previousPercentage: null };
  }
  const hasMasteryQuiz = previous.masteryEnabled && previous.quizQuestions.length > 0;
  const hasVocabulary = (previous.vocabulary?.length ?? 0) > 0;
  const previousCompleted = previous.progress[0]?.state === LessonProgressState.COMPLETED;
  // A lesson with a configured mastery gate is unlocked by the authoritative
  // topic + vocabulary results. The persisted lesson state may still be
  // IN_PROGRESS until the explicit completion mutation records completion.
  if (!previousCompleted && !hasMasteryQuiz && !hasVocabulary) {
    return { allowed: false, lessonId, previousLessonId: previous.id, previousLessonTitle: previous.title, lockReason: 'PREVIOUS_LESSON', requiredPercentage: null, previousPercentage: null };
  }
  if (!hasMasteryQuiz && !hasVocabulary) {
    return { allowed: true, lessonId, previousLessonId: previous.id, previousLessonTitle: previous.title, lockReason: null, requiredPercentage: null, previousPercentage: null };
  }
  const previousPercentage = previous.quizAttempts[0]?.percentage ?? null;
  const vocabularyPercentage = previous.vocabularyTestAttempts?.[0]?.percentage ?? null;
  const allowed = (!hasMasteryQuiz || (previousPercentage !== null && previousPercentage >= previous.masteryPassingPercentage))
    && (!hasVocabulary || (vocabularyPercentage !== null && vocabularyPercentage >= 75));
  return {
    allowed,
    lessonId,
    previousLessonId: previous.id,
    previousLessonTitle: previous.title,
    lockReason: allowed ? null : 'PREVIOUS_MASTERY',
    requiredPercentage: previous.masteryPassingPercentage,
    previousPercentage,
  };
}

export class PrismaLessonMasteryAccess implements LessonMasteryAccess {
  constructor(private readonly client: PrismaClient = prisma) {}

  private async lessonsForEnrollment(enrollmentId: string, courseId: string | undefined, studentId: string): Promise<AccessLesson[] | null> {
    // Course-level access checks do not have an enrollment id yet. Resolve the
    // student's current enrollment first so nested progress/attempt filters
    // never receive an empty UUID (which Prisma rejects at runtime).
    const resolvedEnrollmentId = enrollmentId || (await this.client.courseEnrollment.findFirst({
      where: {
        ...(courseId ? { courseId } : {}),
        studentId,
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
        accessStartsAt: { lte: new Date() },
        accessExpiresAt: { gt: new Date() },
        student: { status: 'ACTIVE', roles: { some: { role: { code: 'STUDENT' } } } },
        course: { status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null },
      },
      select: { id: true },
    }))?.id;
    if (!resolvedEnrollmentId) return null;
    const enrollment = await this.client.courseEnrollment.findFirst({
      where: {
        id: resolvedEnrollmentId,
        ...(courseId ? { courseId } : {}),
        studentId,
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
        accessStartsAt: { lte: new Date() },
        accessExpiresAt: { gt: new Date() },
        student: { status: 'ACTIVE', roles: { some: { role: { code: 'STUDENT' } } } },
        course: { status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null },
      },
      select: {
        course: {
          select: {
            sections: {
              where: { isPublished: true, deletedAt: null },
              orderBy: [{ position: 'asc' }, { id: 'asc' }],
              select: {
                lessons: {
                  where: { status: 'PUBLISHED', deletedAt: null },
                  orderBy: [{ position: 'asc' }, { id: 'asc' }],
                  select: {
                    ...lessonAccessSelect,
                    progress: { where: { enrollmentId: resolvedEnrollmentId }, select: { state: true } },
                    quizAttempts: { where: { enrollmentId: resolvedEnrollmentId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: 1, select: { percentage: true } },
                    vocabularyTestAttempts: { where: { enrollmentId: resolvedEnrollmentId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: 1, select: { percentage: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!enrollment) return null;
    return enrollment.course.sections.flatMap((section) => section.lessons) as AccessLesson[];
  }

  async evaluateCourseLesson(courseId: string, lessonId: string, studentId: string): Promise<LessonMasteryDecision> {
    const lessons = await this.lessonsForEnrollment('', courseId, studentId);
    return lessons ? decisionFor(lessons, lessonId) : { allowed: false, lessonId, previousLessonId: null, previousLessonTitle: null, lockReason: 'PREVIOUS_LESSON', requiredPercentage: null, previousPercentage: null };
  }

  async canAccessCourseLesson(courseId: string, lessonId: string, studentId: string): Promise<boolean> {
    return (await this.evaluateCourseLesson(courseId, lessonId, studentId)).allowed;
  }

  async canAccessEnrollmentLesson(enrollmentId: string, lessonId: string, studentId: string): Promise<boolean> {
    const lessons = await this.lessonsForEnrollment(enrollmentId, undefined, studentId);
    return lessons ? decisionFor(lessons, lessonId).allowed : false;
  }

  async canAccessMedia(mediaId: string, studentId: string): Promise<boolean> {
    const usages = await this.client.lessonContentBlock.findMany({
      where: { mediaFileId: mediaId, deletedAt: null, isVisible: true },
      select: { lesson: { select: { id: true, courseId: true, isPreview: true } } },
    });
    if (usages.length === 0) return false;
    for (const usage of usages) {
      if (usage.lesson.isPreview) return true;
      if (await this.canAccessCourseLesson(usage.lesson.courseId, usage.lesson.id, studentId)) return true;
    }
    return false;
  }
}
