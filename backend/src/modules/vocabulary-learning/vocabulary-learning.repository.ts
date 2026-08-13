import { randomInt } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { VocabularyLearningItem } from './vocabulary-learning.types.js';

const PASSING_PERCENTAGE = 75;
export function normalizeTurkishAnswer(value: string): string { return value.trim().toLocaleLowerCase('tr-TR'); }
const itemSelect = { id: true, lessonId: true, sourceId: true, sourceStatus: true, turkishWord: true, uzbekMeaning: true, exampleSentence: true, position: true } satisfies Prisma.LessonVocabularySelect;
const attemptSelect = { id: true, lessonId: true, enrollmentId: true, startedAt: true, submittedAt: true, score: true, maxScore: true, percentage: true, correctCount: true, incorrectCount: true, status: true } satisfies Prisma.VocabularyTestAttemptSelect;

export class VocabularyLearningRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async assertEnrollment(enrollmentId: string, lessonId: string, studentId: string) {
    const now = new Date();
    const enrollment = await this.client.courseEnrollment.findFirst({ where: { id: enrollmentId, studentId, status: { in: ['ACTIVE', 'COMPLETED'] }, accessStartsAt: { lte: now }, accessExpiresAt: { gt: now }, student: { status: 'ACTIVE', roles: { some: { role: { code: 'STUDENT' } } } }, course: { status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null, lessons: { some: { id: lessonId, status: 'PUBLISHED', deletedAt: null, section: { isPublished: true } } } } }, select: { id: true, courseId: true } });
    return enrollment;
  }

  async listLearning(userId: string, lessonId: string): Promise<VocabularyLearningItem[]> {
    const rows = await this.client.lessonVocabulary.findMany({ where: { lessonId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { ...itemSelect, learnerProgress: { where: { userId }, select: { status: true, reviewCount: true } } } });
    return rows.map((row) => ({ ...row, learnerStatus: row.learnerProgress[0]?.status ?? 'NEW', reviewCount: row.learnerProgress[0]?.reviewCount ?? 0 }));
  }

  async updateStatus(userId: string, lessonId: string, vocabularyId: string, status: 'KNOWN' | 'NEEDS_REVIEW') {
    const vocabulary = await this.client.lessonVocabulary.findFirst({ where: { id: vocabularyId, lessonId, deletedAt: null }, select: { id: true } });
    if (!vocabulary) return null;
    const now = new Date();
    return this.client.studentVocabularyProgress.upsert({ where: { userId_vocabularyId: { userId, vocabularyId } }, create: { userId, vocabularyId, status, firstSeenAt: now, lastReviewedAt: now, reviewCount: 1 }, update: { status, lastReviewedAt: now, reviewCount: { increment: 1 } }, select: { vocabularyId: true, status: true, reviewCount: true, lastReviewedAt: true } });
  }

  async listTestItems(lessonId: string) {
    const items = await this.client.lessonVocabulary.findMany({ where: { lessonId, deletedAt: null, sourceStatus: { not: 'QUESTIONABLE' } }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: itemSelect });
    for (let index = items.length - 1; index > 0; index -= 1) { const swap = randomInt(index + 1); const current = items[index]; const target = items[swap]; if (current && target) { items[index] = target; items[swap] = current; } }
    return items.slice(0, Math.min(items.length, 20));
  }

  async countFailedAttemptsToday(enrollmentId: string, lessonId: string, now = new Date()) {
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.client.vocabularyTestAttempt.count({ where: { enrollmentId, lessonId, status: 'SUBMITTED', submittedAt: { gte: dayStart, lte: now }, percentage: { lt: PASSING_PERCENTAGE } } });
  }

  findOpenAttempt(enrollmentId: string, lessonId: string) { return this.client.vocabularyTestAttempt.findFirst({ where: { enrollmentId, lessonId, status: 'IN_PROGRESS' }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], select: attemptSelect }); }

  async createAttempt(enrollmentId: string, lessonId: string, items: Array<{ id: string }>) {
    return this.client.$transaction(async (tx) => {
      const attempt = await tx.vocabularyTestAttempt.create({ data: { enrollmentId, lessonId, maxScore: items.length }, select: attemptSelect });
      await tx.vocabularyTestAnswer.createMany({ data: items.map((item) => ({ attemptId: attempt.id, vocabularyId: item.id, submittedAnswer: '' })) });
      return attempt;
    });
  }

  findAttempt(attemptId: string, enrollmentId: string, lessonId: string) { return this.client.vocabularyTestAttempt.findFirst({ where: { id: attemptId, enrollmentId, lessonId }, select: { ...attemptSelect, answers: { select: { vocabularyId: true } } } }); }

  async submitAttempt(attemptId: string, questions: Array<{ vocabularyId: string; turkishWord: string }>, answers: Array<{ vocabularyId: string; submittedAnswer: string }>) {
    return this.client.$transaction(async (tx) => {
      const attempt = await tx.vocabularyTestAttempt.findUnique({ where: { id: attemptId }, select: { id: true, status: true, maxScore: true } });
      if (!attempt || attempt.status !== 'IN_PROGRESS') return null;
      const answerMap = new Map(answers.map((answer) => [answer.vocabularyId, answer.submittedAnswer]));
      let correctCount = 0;
      const graded = questions.map((question) => { const submittedAnswer = answerMap.get(question.vocabularyId) ?? ''; const isCorrect = normalizeTurkishAnswer(submittedAnswer) === normalizeTurkishAnswer(question.turkishWord); if (isCorrect) correctCount += 1; return { vocabularyId: question.vocabularyId, submittedAnswer, isCorrect, awardedPoints: isCorrect ? 1 : 0 }; });
      const score = correctCount;
      return tx.vocabularyTestAttempt.update({ where: { id: attemptId }, data: { status: 'SUBMITTED', submittedAt: new Date(), score, percentage: Math.round((score / attempt.maxScore) * 100), correctCount, incorrectCount: questions.length - correctCount, answers: { deleteMany: {}, create: graded } }, select: attemptSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  latestResult(enrollmentId: string, lessonId: string) { return this.client.vocabularyTestAttempt.findFirst({ where: { enrollmentId, lessonId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], select: attemptSelect }); }
  async attemptQuestions(attemptId: string) { return this.client.vocabularyTestAnswer.findMany({ where: { attemptId }, select: { vocabularyId: true, vocabulary: { select: { turkishWord: true, uzbekMeaning: true } } } }); }
}

export { PASSING_PERCENTAGE as VOCABULARY_PASSING_PERCENTAGE };
