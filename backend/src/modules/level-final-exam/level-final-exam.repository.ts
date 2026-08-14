import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { LevelFinalExamAttempt } from './level-final-exam.types.js';

const examSelect = { id: true, level: true, title: true, passingPercentage: true, questionCount: true } satisfies Prisma.LevelFinalExamSelect;
const attemptSelect = { id: true, examId: true, enrollmentId: true, startedAt: true, submittedAt: true, score: true, maxScore: true, percentage: true, correctCount: true, incorrectCount: true, status: true } satisfies Prisma.LevelFinalExamAttemptSelect;
const internalQuestionSelect = { id: true, type: true, prompt: true, points: true, position: true, options: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], select: { id: true, text: true, isCorrect: true, position: true } } } satisfies Prisma.LessonQuizQuestionSelect;

export class LevelFinalExamRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  findEnrollment(enrollmentId: string, studentId: string) {
    const now = new Date();
    return this.client.courseEnrollment.findFirst({ where: { id: enrollmentId, studentId, status: { in: ['ACTIVE', 'COMPLETED'] }, accessStartsAt: { lte: now }, accessExpiresAt: { gt: now }, student: { status: 'ACTIVE', roles: { some: { role: { code: 'STUDENT' } } } }, course: { status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null } }, select: { id: true, courseId: true, course: { select: { id: true, level: true } } } });
  }

  findExam(level: NonNullable<Awaited<ReturnType<LevelFinalExamRepository['findEnrollment']>>>['course']['level']) {
    return level ? this.client.levelFinalExam.findUnique({ where: { level }, select: examSelect }) : null;
  }

  listQuestions(examId: string) {
    return this.client.levelFinalExamQuestion.findMany({ where: { examId, deletedAt: null, sourceQuestion: { deletedAt: null } }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, position: true, sourceQuestion: { select: internalQuestionSelect } } });
  }

  latestResult(examId: string, enrollmentId: string) { return this.client.levelFinalExamAttempt.findFirst({ where: { examId, enrollmentId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], select: attemptSelect }); }

  hasPassed(examId: string, enrollmentId: string, passingPercentage: number) { return this.client.levelFinalExamAttempt.findFirst({ where: { examId, enrollmentId, status: 'SUBMITTED', percentage: { gte: passingPercentage } }, select: { id: true } }); }

  countFailedToday(examId: string, enrollmentId: string, passingPercentage: number, now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.client.levelFinalExamAttempt.count({ where: { examId, enrollmentId, status: 'SUBMITTED', submittedAt: { gte: start, lte: now }, percentage: { lt: passingPercentage } } });
  }

  findOpenAttempt(examId: string, enrollmentId: string) { return this.client.levelFinalExamAttempt.findFirst({ where: { examId, enrollmentId, status: 'IN_PROGRESS' }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], select: attemptSelect }); }

  createAttempt(examId: string, enrollmentId: string, maxScore: number) { return this.client.levelFinalExamAttempt.create({ data: { examId, enrollmentId, maxScore }, select: attemptSelect }); }

  findAttempt(attemptId: string, examId: string, enrollmentId: string) { return this.client.levelFinalExamAttempt.findFirst({ where: { id: attemptId, examId, enrollmentId }, select: { ...attemptSelect, answers: { select: { questionId: true } } } }); }

  async submitAttempt(attemptId: string, questions: Array<{ id: string; type: string; points: number; options: Array<{ id: string; text: string; isCorrect: boolean }> }>, answers: Array<{ questionId: string; submittedAnswer: string }>): Promise<LevelFinalExamAttempt | null> {
    return this.client.$transaction(async (tx) => {
      const attempt = await tx.levelFinalExamAttempt.findUnique({ where: { id: attemptId }, select: { id: true, status: true, maxScore: true } });
      if (!attempt || attempt.status !== 'IN_PROGRESS') return null;
      const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.submittedAnswer]));
      let score = 0;
      let correctCount = 0;
      const graded = questions.map((question) => {
        const submittedAnswer = answerMap.get(question.id) ?? '';
        const normalized = submittedAnswer.trim().toLocaleLowerCase('tr-TR');
        const correctOptions = question.options.filter((option) => option.isCorrect);
        const isCorrect = question.type === 'MISSING_WORD'
          ? correctOptions.some((option) => option.text.trim().toLocaleLowerCase('tr-TR') === normalized)
          : correctOptions.some((option) => option.id === submittedAnswer);
        if (isCorrect) { score += question.points; correctCount += 1; }
        return { questionId: question.id, submittedAnswer, isCorrect, awardedPoints: isCorrect ? question.points : 0 };
      });
      const updated = await tx.levelFinalExamAttempt.update({ where: { id: attemptId }, data: { status: 'SUBMITTED', submittedAt: new Date(), score, percentage: Math.round((score / attempt.maxScore) * 100), correctCount, incorrectCount: questions.length - correctCount, answers: { create: graded } }, select: attemptSelect });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export type InternalFinalExamQuestion = Awaited<ReturnType<LevelFinalExamRepository['listQuestions']>>[number];
