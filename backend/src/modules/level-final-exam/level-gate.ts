import { CourseEnrollmentStatus, CourseLevel, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export const LEVEL_ORDER: readonly CourseLevel[] = [
  CourseLevel.A1,
  CourseLevel.A2,
  CourseLevel.B1,
  CourseLevel.B2,
  CourseLevel.C1,
  CourseLevel.C2,
];

export type LevelGateReason =
  | 'NONE'
  | 'PREVIOUS_LEVEL_REQUIRED'
  | 'LESSONS_REQUIRED'
  | 'FINAL_EXAM_REQUIRED'
  | 'FINAL_EXAM_NOT_CONFIGURED';

export interface LevelGateState {
  targetLevel: CourseLevel;
  previousLevel: CourseLevel | null;
  allowed: boolean;
  reason: LevelGateReason;
  previousCourseId: string | null;
  previousEnrollmentId: string | null;
  lessonsTotal: number;
  lessonsMastered: number;
  examId: string | null;
  examQuestionCount: number;
  passingPercentage: number;
  examPassed: boolean;
  latestExamPercentage: number | null;
  remainingRequirements: string[];
}

interface LessonMasterySnapshot {
  title: string;
  mastered: boolean;
  topicPercentage: number | null;
  vocabularyPercentage: number | null;
  topicRequired: boolean;
  vocabularyRequired: boolean;
  passingPercentage: number;
}

function previousLevelOf(level: CourseLevel): CourseLevel | null {
  const index = LEVEL_ORDER.indexOf(level);
  return index > 0 ? LEVEL_ORDER[index - 1] ?? null : null;
}

function lessonMastered(snapshot: LessonMasterySnapshot): boolean {
  if (!snapshot.topicRequired && !snapshot.vocabularyRequired) {
    return false;
  }
  const topicPassed = !snapshot.topicRequired || (snapshot.topicPercentage !== null && snapshot.topicPercentage >= snapshot.passingPercentage);
  const vocabularyPassed = !snapshot.vocabularyRequired || (snapshot.vocabularyPercentage !== null && snapshot.vocabularyPercentage >= 75);
  return topicPassed && vocabularyPassed;
}

export class PrismaLevelGate {
  constructor(private readonly client: PrismaClient = prisma) {}

  private async previousEnrollment(studentId: string, previousLevel: CourseLevel) {
    return this.client.courseEnrollment.findFirst({
      where: {
        studentId,
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
        course: { level: previousLevel, deletedAt: null },
      },
      orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
      select: { id: true, courseId: true, course: { select: { id: true, level: true } } },
    });
  }

  private async lessonSnapshots(courseId: string, enrollmentId: string): Promise<LessonMasterySnapshot[]> {
    const lessons = await this.client.lesson.findMany({
      where: { courseId, status: 'PUBLISHED', deletedAt: null, section: { isPublished: true, deletedAt: null } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: {
        title: true,
        masteryEnabled: true,
        masteryPassingPercentage: true,
        quizQuestions: { where: { deletedAt: null }, take: 1, select: { id: true } },
        vocabulary: { where: { deletedAt: null }, take: 1, select: { id: true } },
        quizAttempts: { where: { enrollmentId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: 1, select: { percentage: true } },
        vocabularyTestAttempts: { where: { enrollmentId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: 1, select: { percentage: true } },
        progress: { where: { enrollmentId }, take: 1, select: { state: true } },
      },
    });
    return lessons.map((lesson) => {
      const topicRequired = lesson.masteryEnabled && lesson.quizQuestions.length > 0;
      const vocabularyRequired = lesson.vocabulary.length > 0;
      const snapshot = {
        title: lesson.title,
        mastered: false,
        topicPercentage: lesson.quizAttempts[0]?.percentage ?? null,
        vocabularyPercentage: lesson.vocabularyTestAttempts[0]?.percentage ?? null,
        topicRequired,
        vocabularyRequired,
        passingPercentage: lesson.masteryPassingPercentage,
      };
      return { ...snapshot, mastered: lessonMastered(snapshot) };
    });
  }

  async evaluateCourseLessons(courseId: string, enrollmentId: string): Promise<{ total: number; mastered: number; remaining: string[] }> {
    const lessons = await this.lessonSnapshots(courseId, enrollmentId);
    const mastered = lessons.filter((lesson) => lesson.mastered).length;
    return {
      total: lessons.length,
      mastered,
      remaining: lessons.flatMap((lesson) => lesson.mastered ? [] : [`${lesson.title} darsining mavzu va lug‘at talablarini bajaring.`]),
    };
  }

  async evaluate(level: CourseLevel, studentId: string): Promise<LevelGateState> {
    const previousLevel = previousLevelOf(level);
    if (!previousLevel) {
      return {
        targetLevel: level,
        previousLevel: null,
        allowed: true,
        reason: 'NONE',
        previousCourseId: null,
        previousEnrollmentId: null,
        lessonsTotal: 0,
        lessonsMastered: 0,
        examId: null,
        examQuestionCount: 0,
        passingPercentage: 75,
        examPassed: true,
        latestExamPercentage: null,
        remainingRequirements: [],
      };
    }

    const enrollment = await this.previousEnrollment(studentId, previousLevel);
    if (!enrollment) {
      return {
        targetLevel: level,
        previousLevel,
        allowed: false,
        reason: 'PREVIOUS_LEVEL_REQUIRED',
        previousCourseId: null,
        previousEnrollmentId: null,
        lessonsTotal: 0,
        lessonsMastered: 0,
        examId: null,
        examQuestionCount: 0,
        passingPercentage: 75,
        examPassed: false,
        latestExamPercentage: null,
        remainingRequirements: [`${previousLevel} kursiga yoziling.`],
      };
    }

    const lessons = await this.lessonSnapshots(enrollment.courseId, enrollment.id);
    const lessonsMastered = lessons.filter((lesson) => lesson.mastered).length;
    const exam = await this.client.levelFinalExam.findUnique({ where: { level: previousLevel }, select: { id: true, passingPercentage: true, questionCount: true } });
    const attempts = exam ? await this.client.levelFinalExamAttempt.findMany({ where: { examId: exam.id, enrollmentId: enrollment.id, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], select: { percentage: true } }) : [];
    const latestExamPercentage = attempts[0]?.percentage ?? null;
    const examPassed = Boolean(exam && attempts.some((attempt) => attempt.percentage >= exam.passingPercentage));
    const remainingRequirements = lessons.flatMap((lesson) => lesson.mastered ? [] : [`${lesson.title} darsini kamida 75% mavzu va lug‘at natijasi bilan yakunlang.`]);
    if (lessonsMastered < lessons.length) remainingRequirements.push(`${previousLevel} darslarining barchasini o‘zlashtiring.`);
    if (!exam) remainingRequirements.push(`${previousLevel} yakuniy imtihoni hali tayyor emas.`);
    else if (!examPassed) remainingRequirements.push(`${previousLevel} yakuniy imtihonidan kamida ${exam.passingPercentage}% oling.`);

    const reason: LevelGateReason = !exam ? 'FINAL_EXAM_NOT_CONFIGURED' : lessonsMastered < lessons.length ? 'LESSONS_REQUIRED' : !examPassed ? 'FINAL_EXAM_REQUIRED' : 'NONE';
    return {
      targetLevel: level,
      previousLevel,
      allowed: lessons.length > 0 && lessonsMastered === lessons.length && examPassed,
      reason,
      previousCourseId: enrollment.courseId,
      previousEnrollmentId: enrollment.id,
      lessonsTotal: lessons.length,
      lessonsMastered,
      examId: exam?.id ?? null,
      examQuestionCount: exam?.questionCount ?? 0,
      passingPercentage: exam?.passingPercentage ?? 75,
      examPassed,
      latestExamPercentage,
      remainingRequirements,
    };
  }

  async canAccessCourse(courseId: string, studentId: string): Promise<boolean> {
    const course = await this.client.course.findUnique({ where: { id: courseId }, select: { level: true } });
    return course?.level ? (await this.evaluate(course.level, studentId)).allowed : false;
  }
}

export const levelOrder = LEVEL_ORDER;
