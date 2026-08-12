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
  const previousCompleted = previous.progress[0]?.state === LessonProgressState.COMPLETED;
  if (!previousCompleted) {
    return { allowed: false, lessonId, previousLessonId: previous.id, previousLessonTitle: previous.title, lockReason: 'PREVIOUS_LESSON', requiredPercentage: null, previousPercentage: null };
  }
  const hasMasteryQuiz = previous.masteryEnabled && previous.quizQuestions.length > 0;
  if (!hasMasteryQuiz) {
    return { allowed: true, lessonId, previousLessonId: previous.id, previousLessonTitle: previous.title, lockReason: null, requiredPercentage: null, previousPercentage: null };
  }
  const previousPercentage = previous.quizAttempts[0]?.percentage ?? null;
  const allowed = previousPercentage !== null && previousPercentage >= previous.masteryPassingPercentage;
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
    const enrollment = await this.client.courseEnrollment.findFirst({
      where: {
        ...(enrollmentId ? { id: enrollmentId } : {}),
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
                    progress: { where: { enrollmentId }, select: { state: true } },
                    quizAttempts: { where: { enrollmentId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: 1, select: { percentage: true } },
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
