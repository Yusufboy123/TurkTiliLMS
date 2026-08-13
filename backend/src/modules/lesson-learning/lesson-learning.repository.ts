import { randomInt } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { CreateQuestionInput, CreateVocabularyInput, UpdateQuestionInput, UpdateVocabularyInput } from './lesson-learning.schemas.js';
import { storedInteractivePracticeFromMetadata } from '../lesson-content-blocks/lesson-content-block.repository.js';
import type { StoredInteractivePracticeItem } from '../lesson-content-blocks/lesson-content-block.types.js';

const vocabularySelect = {
  id: true, lessonId: true, turkishWord: true, uzbekMeaning: true, exampleSentence: true,
  position: true, createdAt: true, updatedAt: true,
} satisfies Prisma.LessonVocabularySelect;

const questionSelect = {
  id: true, lessonId: true, type: true, prompt: true, explanation: true, points: true,
  position: true, createdAt: true, updatedAt: true,
  options: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], select: { id: true, text: true, isCorrect: true, position: true } },
} satisfies Prisma.LessonQuizQuestionSelect;

const attemptSelect = {
  id: true, lessonId: true, enrollmentId: true, startedAt: true, submittedAt: true, score: true,
  maxScore: true, percentage: true, correctCount: true, incorrectCount: true, status: true,
} satisfies Prisma.LessonQuizAttemptSelect;

export class LessonLearningRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  findLesson(courseId: string, lessonId: string) {
    return this.client.lesson.findFirst({ where: { id: lessonId, ...(courseId ? { courseId } : {}) }, select: { id: true, courseId: true, deletedAt: true, status: true, masteryEnabled: true, masteryPassingPercentage: true, course: { select: { id: true, teacherId: true, deletedAt: true } } } });
  }

  findEnrollment(enrollmentId: string) {
    return this.client.courseEnrollment.findUnique({ where: { id: enrollmentId }, select: { id: true, courseId: true, studentId: true, status: true, course: { select: { id: true, teacherId: true, deletedAt: true } }, student: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true, status: true } } } });
  }

  listVocabulary(lessonId: string) {
    return this.client.lessonVocabulary.findMany({ where: { lessonId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: vocabularySelect });
  }

  createVocabulary(lessonId: string, input: CreateVocabularyInput) {
    return this.client.$transaction(async (transaction) => {
      const position = input.position ?? ((await transaction.lessonVocabulary.aggregate({ where: { lessonId, deletedAt: null }, _max: { position: true } }))._max.position ?? 0) + 1;
      return transaction.lessonVocabulary.create({ data: { lessonId, turkishWord: input.turkishWord, uzbekMeaning: input.uzbekMeaning, exampleSentence: input.exampleSentence ?? null, position }, select: vocabularySelect });
    });
  }

  findVocabulary(lessonId: string, vocabularyId: string) {
    return this.client.lessonVocabulary.findFirst({ where: { id: vocabularyId, lessonId, deletedAt: null }, select: vocabularySelect });
  }

  updateVocabulary(lessonId: string, vocabularyId: string, input: UpdateVocabularyInput) {
    void lessonId;
    const data = {
      ...(input.turkishWord !== undefined ? { turkishWord: input.turkishWord } : {}),
      ...(input.uzbekMeaning !== undefined ? { uzbekMeaning: input.uzbekMeaning } : {}),
      ...(input.exampleSentence !== undefined ? { exampleSentence: input.exampleSentence } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    };
    return this.client.lessonVocabulary.update({ where: { id: vocabularyId }, data, select: vocabularySelect });
  }

  async deleteVocabulary(lessonId: string, vocabularyId: string): Promise<boolean> {
    const result = await this.client.lessonVocabulary.updateMany({ where: { id: vocabularyId, lessonId, deletedAt: null }, data: { deletedAt: new Date() } });
    return result.count === 1;
  }

  listQuestions(lessonId: string) {
    return this.client.lessonQuizQuestion.findMany({ where: { lessonId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: questionSelect });
  }

  createQuestion(lessonId: string, input: CreateQuestionInput) {
    return this.client.$transaction(async (transaction) => {
      const position = input.position ?? ((await transaction.lessonQuizQuestion.aggregate({ where: { lessonId, deletedAt: null }, _max: { position: true } }))._max.position ?? 0) + 1;
      return transaction.lessonQuizQuestion.create({ data: { lessonId, type: input.type, prompt: input.prompt, explanation: input.explanation ?? null, points: input.points, position, options: { create: (input.options ?? []).map((option, index) => ({ text: option.text, isCorrect: option.isCorrect, position: option.position ?? index + 1 })) } }, select: questionSelect });
    });
  }

  findQuestion(lessonId: string, questionId: string) {
    return this.client.lessonQuizQuestion.findFirst({ where: { id: questionId, lessonId, deletedAt: null }, select: questionSelect });
  }

  updateQuestion(lessonId: string, questionId: string, input: UpdateQuestionInput) {
    return this.client.$transaction(async (transaction) => {
      const current = await transaction.lessonQuizQuestion.findFirst({ where: { id: questionId, lessonId, deletedAt: null }, select: { type: true, prompt: true, explanation: true, points: true, position: true } });
      if (!current) return null;
      if (input.options !== undefined) await transaction.lessonQuizOption.deleteMany({ where: { questionId } });
      return transaction.lessonQuizQuestion.update({ where: { id: questionId }, data: { ...(input.type !== undefined ? { type: input.type } : {}), ...(input.prompt !== undefined ? { prompt: input.prompt } : {}), ...(input.explanation !== undefined ? { explanation: input.explanation } : {}), ...(input.points !== undefined ? { points: input.points } : {}), ...(input.position !== undefined ? { position: input.position } : {}), ...(input.options !== undefined ? { options: { create: input.options.map((option, index) => ({ text: option.text, isCorrect: option.isCorrect, position: option.position ?? index + 1 })) } } : {}) }, select: questionSelect });
    });
  }

  async deleteQuestion(lessonId: string, questionId: string): Promise<boolean> {
    const result = await this.client.lessonQuizQuestion.updateMany({ where: { id: questionId, lessonId, deletedAt: null }, data: { deletedAt: new Date() } });
    return result.count === 1;
  }

  findActiveStudentEnrollment(enrollmentId: string, lessonId: string, studentId: string) {
    const now = new Date();
    return this.client.courseEnrollment.findFirst({ where: { id: enrollmentId, studentId, status: { in: ['ACTIVE', 'COMPLETED'] }, accessStartsAt: { lte: now }, accessExpiresAt: { gt: now }, student: { status: 'ACTIVE', roles: { some: { role: { code: 'STUDENT' } } } }, course: { status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null, lessons: { some: { id: lessonId, status: 'PUBLISHED', deletedAt: null, section: { isPublished: true } } } } }, select: { id: true, courseId: true, studentId: true } });
  }

  async findStudentQuestions(lessonId: string) {
    const questions = await this.client.lessonQuizQuestion.findMany({ where: { lessonId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, type: true, prompt: true, points: true, position: true, options: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, text: true, position: true } } } });
    const shuffledQuestions = [...questions];
    for (let index = shuffledQuestions.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      const current = shuffledQuestions[index];
      const target = shuffledQuestions[swapIndex];
      if (current && target) {
        shuffledQuestions[index] = target;
        shuffledQuestions[swapIndex] = current;
      }
    }
    return shuffledQuestions.map((question) => {
      if (question.type !== 'MULTIPLE_CHOICE') return question;
      const options = [...question.options];
      for (let index = options.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        const current = options[index];
        const target = options[swapIndex];
        if (current && target) {
          options[index] = target;
          options[swapIndex] = current;
        }
      }
      return { ...question, options };
    });
  }

  createAttempt(enrollmentId: string, lessonId: string, maxScore: number) {
    return this.client.lessonQuizAttempt.create({ data: { enrollmentId, lessonId, maxScore }, select: attemptSelect });
  }

  findOpenAttempt(enrollmentId: string, lessonId: string) {
    return this.client.lessonQuizAttempt.findFirst({
      where: { enrollmentId, lessonId, status: 'IN_PROGRESS' },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: attemptSelect,
    });
  }

  async countFailedAttemptsToday(enrollmentId: string, lessonId: string, passingPercentage: number, now = new Date()): Promise<number> {
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.client.lessonQuizAttempt.count({
      where: { enrollmentId, lessonId, status: 'SUBMITTED', submittedAt: { gte: dayStart, lte: now }, percentage: { lt: passingPercentage } },
    });
  }

  async findInteractivePractice(lessonId: string, practiceId: string): Promise<StoredInteractivePracticeItem | null> {
    const blocks = await this.client.lessonContentBlock.findMany({ where: { lessonId, deletedAt: null, isVisible: true }, select: { metadata: true } });
    for (const block of blocks) {
      const item = storedInteractivePracticeFromMetadata(block.metadata)?.find((practice) => practice.id === practiceId);
      if (item) return item;
    }
    return null;
  }

  findAttempt(attemptId: string, enrollmentId: string, lessonId: string) {
    return this.client.lessonQuizAttempt.findFirst({ where: { id: attemptId, enrollmentId, lessonId }, select: { ...attemptSelect, answers: { select: { questionId: true } } } });
  }

  submitAttempt(attemptId: string, questions: Array<{ id: string; type: string; points: number; options: Array<{ id: string; text: string; isCorrect: boolean }> }>, answers: Array<{ questionId: string; submittedAnswer: string }>) {
    return this.client.$transaction(async (transaction) => {
      const attempt = await transaction.lessonQuizAttempt.findUnique({ where: { id: attemptId }, select: { id: true, status: true, maxScore: true } });
      if (!attempt) return null;
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
      if (attempt.status !== 'IN_PROGRESS') return null;
      const updated = await transaction.lessonQuizAttempt.update({ where: { id: attemptId }, data: { status: 'SUBMITTED', submittedAt: new Date(), score, percentage: Math.round((score / attempt.maxScore) * 100), correctCount, incorrectCount: questions.length - correctCount, answers: { create: graded } }, select: attemptSelect });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  latestResult(enrollmentId: string, lessonId: string) {
    return this.client.lessonQuizAttempt.findFirst({ where: { enrollmentId, lessonId, status: 'SUBMITTED' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], select: attemptSelect });
  }

  async teacherResults(courseId: string, lessonId: string) {
    const enrollments = await this.client.courseEnrollment.findMany({ where: { courseId, course: { lessons: { some: { id: lessonId, deletedAt: null } } }, student: { roles: { some: { role: { code: 'STUDENT' } } } } }, orderBy: [{ enrolledAt: 'asc' }, { studentId: 'asc' }], select: { id: true, student: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } } } });
    return Promise.all(enrollments.map(async (enrollment) => ({ enrollment, attempt: await this.latestResult(enrollment.id, lessonId) })));
  }
}

export type LessonContext = Awaited<ReturnType<LessonLearningRepository['findLesson']>>;
export type EnrollmentContext = Awaited<ReturnType<LessonLearningRepository['findEnrollment']>>;
