import { Prisma, RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { CreateQuestionInput, CreateVocabularyInput, SubmitQuizInput, UpdateQuestionInput, UpdateVocabularyInput } from './lesson-learning.schemas.js';
import type { EnrollmentContext, LessonLearningRepository } from './lesson-learning.repository.js';
import type { LearningActor, QuizQuestionRecord, StudentQuizQuestion } from './lesson-learning.types.js';
import type { LessonMasteryAccess } from '../lesson-mastery/lesson-mastery.types.js';

function isAdmin(actor: LearningActor): boolean {
  return actor.roles.includes(RoleCode.ADMIN);
}

function requirePermission(actor: LearningActor, permission: string): void {
  if (!actor.permissions.includes(permission)) throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

function lessonNotFound(): AppError {
  return new AppError('Dars topilmadi.', 404, 'LESSON_NOT_FOUND');
}

function vocabularyNotFound(): AppError {
  return new AppError('Lug‘at yozuvi topilmadi.', 404, 'VOCABULARY_NOT_FOUND');
}

function questionNotFound(): AppError {
  return new AppError('Test savoli topilmadi.', 404, 'QUIZ_QUESTION_NOT_FOUND');
}

function assertQuestionOptions(type: CreateQuestionInput['type'], options: CreateQuestionInput['options']): void {
  const values = options ?? [];
  const correct = values.filter((option) => option.isCorrect);
  if (type === 'MULTIPLE_CHOICE' && (values.length < 2 || correct.length !== 1)) throw new AppError('Multiple choice savolida kamida ikki variant va bitta to‘g‘ri javob bo‘lishi kerak.', 422, 'QUIZ_OPTIONS_INVALID');
  if (type === 'TRUE_FALSE' && (values.length !== 2 || correct.length !== 1)) throw new AppError('True/False savolida ikki variant va bitta to‘g‘ri javob bo‘lishi kerak.', 422, 'QUIZ_OPTIONS_INVALID');
  if (type === 'MISSING_WORD' && (values.length !== 1 || correct.length !== 1)) throw new AppError('Missing word savolida bitta javob bo‘lishi kerak.', 422, 'QUIZ_OPTIONS_INVALID');
  if (new Set(values.map((option) => option.text.trim().toLocaleLowerCase('tr-TR'))).size !== values.length) throw new AppError('Test variantlari takrorlanmasligi kerak.', 422, 'QUIZ_OPTIONS_DUPLICATE');
}

function mapAttempt(attempt: { id: string; lessonId: string; enrollmentId: string; startedAt: Date; submittedAt: Date | null; score: number; maxScore: number; percentage: number; correctCount: number; incorrectCount: number; status: 'IN_PROGRESS' | 'SUBMITTED' }) {
  return attempt;
}

export class LessonLearningService {
  constructor(
    private readonly repository: LessonLearningRepository,
    private readonly masteryAccess?: LessonMasteryAccess,
  ) {}

  private async managedLesson(courseId: string, lessonId: string, actor: LearningActor) {
    const lesson = await this.repository.findLesson(courseId, lessonId);
    if (!lesson || lesson.deletedAt || lesson.course.deletedAt) throw lessonNotFound();
    if (!isAdmin(actor) && lesson.course.teacherId !== actor.userId) throw new AppError('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
    return lesson;
  }

  async listVocabulary(courseId: string, lessonId: string, actor: LearningActor) {
    await this.managedLesson(courseId, lessonId, actor);
    return this.repository.listVocabulary(lessonId);
  }

  async createVocabulary(courseId: string, lessonId: string, input: CreateVocabularyInput, actor: LearningActor) {
    requirePermission(actor, 'lessons.update');
    await this.managedLesson(courseId, lessonId, actor);
    return this.repository.createVocabulary(lessonId, input);
  }

  async updateVocabulary(courseId: string, lessonId: string, vocabularyId: string, input: UpdateVocabularyInput, actor: LearningActor) {
    requirePermission(actor, 'lessons.update');
    await this.managedLesson(courseId, lessonId, actor);
    if (!(await this.repository.findVocabulary(lessonId, vocabularyId))) throw vocabularyNotFound();
    return this.repository.updateVocabulary(lessonId, vocabularyId, input);
  }

  async deleteVocabulary(courseId: string, lessonId: string, vocabularyId: string, actor: LearningActor) {
    requirePermission(actor, 'lessons.update');
    await this.managedLesson(courseId, lessonId, actor);
    if (!(await this.repository.deleteVocabulary(lessonId, vocabularyId))) throw vocabularyNotFound();
  }

  async listQuestions(courseId: string, lessonId: string, actor: LearningActor): Promise<QuizQuestionRecord[]> {
    await this.managedLesson(courseId, lessonId, actor);
    return this.repository.listQuestions(lessonId);
  }

  async createQuestion(courseId: string, lessonId: string, input: CreateQuestionInput, actor: LearningActor) {
    requirePermission(actor, 'lessons.update');
    await this.managedLesson(courseId, lessonId, actor);
    assertQuestionOptions(input.type, input.options);
    return this.repository.createQuestion(lessonId, input);
  }

  async updateQuestion(courseId: string, lessonId: string, questionId: string, input: UpdateQuestionInput, actor: LearningActor) {
    requirePermission(actor, 'lessons.update');
    await this.managedLesson(courseId, lessonId, actor);
    const current = await this.repository.findQuestion(lessonId, questionId);
    if (!current) throw questionNotFound();
    const merged = { type: input.type ?? current.type, prompt: input.prompt ?? current.prompt, points: input.points ?? current.points, options: input.options ?? current.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect, position: option.position })) };
    assertQuestionOptions(merged.type, merged.options);
    return this.repository.updateQuestion(lessonId, questionId, input);
  }

  async deleteQuestion(courseId: string, lessonId: string, questionId: string, actor: LearningActor) {
    requirePermission(actor, 'lessons.update');
    await this.managedLesson(courseId, lessonId, actor);
    if (!(await this.repository.deleteQuestion(lessonId, questionId))) throw questionNotFound();
  }

  private async studentEnrollment(enrollmentId: string, lessonId: string, actor: LearningActor): Promise<EnrollmentContext> {
    if (!actor.roles.includes(RoleCode.STUDENT)) throw new AppError('Bu amal faqat student uchun.', 403, 'ACCESS_DENIED');
    const enrollment = await this.repository.findActiveStudentEnrollment(enrollmentId, lessonId, actor.userId);
    if (!enrollment) throw new AppError('Kurs enrollment’i topilmadi yoki unga kirish mumkin emas.', 403, 'ENROLLMENT_ACCESS_DENIED');
    if (this.masteryAccess && !(await this.masteryAccess.canAccessEnrollmentLesson(enrollmentId, lessonId, actor.userId))) {
      throw new AppError('Avval oldingi darsni o‘zlashtiring.', 403, 'LESSON_MASTERY_LOCKED');
    }
    return enrollment as EnrollmentContext;
  }

  async studentVocabulary(enrollmentId: string, lessonId: string, actor: LearningActor) {
    await this.studentEnrollment(enrollmentId, lessonId, actor);
    return this.repository.listVocabulary(lessonId);
  }

  async studentQuiz(enrollmentId: string, lessonId: string, actor: LearningActor) {
    await this.studentEnrollment(enrollmentId, lessonId, actor);
    const questions = await this.repository.findStudentQuestions(lessonId);
    return { lessonId, questions: questions.map((question) => ({ ...question, options: question.type === 'MISSING_WORD' ? [] : question.options })) } satisfies { lessonId: string; questions: StudentQuizQuestion[] };
  }

  async startAttempt(enrollmentId: string, lessonId: string, actor: LearningActor) {
    await this.studentEnrollment(enrollmentId, lessonId, actor);
    const lesson = await this.repository.findLesson('', lessonId);
    if (lesson?.masteryEnabled && (await this.repository.countFailedAttemptsToday(enrollmentId, lessonId, lesson.masteryPassingPercentage)) >= 3) {
      throw new AppError('Bugungi yakuniy test urinishlari tugadi. Darsni qayta ko‘rib chiqing va ertaga yana urinib ko‘ring.', 429, 'QUIZ_DAILY_LIMIT_REACHED');
    }
    const questions = await this.repository.listQuestions(lessonId);
    if (questions.length === 0) throw new AppError('Bu darsda test savollari mavjud emas.', 409, 'QUIZ_EMPTY');
    const existing = await this.repository.findOpenAttempt(enrollmentId, lessonId);
    if (existing) return existing;
    try {
      return await this.repository.createAttempt(enrollmentId, lessonId, questions.reduce((sum, question) => sum + question.points, 0));
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.repository.findOpenAttempt(enrollmentId, lessonId);
        if (concurrent) return concurrent;
        throw new AppError('Bu dars uchun ochiq test urinishi mavjud.', 409, 'QUIZ_ATTEMPT_IN_PROGRESS');
      }
      throw error;
    }
  }

  async submitAttempt(enrollmentId: string, lessonId: string, attemptId: string, input: SubmitQuizInput, actor: LearningActor) {
    await this.studentEnrollment(enrollmentId, lessonId, actor);
    const attempt = await this.repository.findAttempt(attemptId, enrollmentId, lessonId);
    if (!attempt) throw new AppError('Test urinishi topilmadi.', 404, 'QUIZ_ATTEMPT_NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') throw new AppError('Bu test urinishi allaqachon yuborilgan.', 409, 'QUIZ_ATTEMPT_SUBMITTED');
    const questions = await this.repository.listQuestions(lessonId);
    const questionIds = new Set(questions.map((question) => question.id));
    if (new Set(input.answers.map((answer) => answer.questionId)).size !== input.answers.length || input.answers.some((answer) => !questionIds.has(answer.questionId)) || input.answers.length !== questions.length) throw new AppError('Test javoblari noto‘g‘ri yoki to‘liq emas.', 422, 'QUIZ_ANSWERS_INVALID');
    let result: Awaited<ReturnType<LessonLearningRepository['submitAttempt']>>;
    try {
      result = await this.repository.submitAttempt(attemptId, questions.map((question) => ({ id: question.id, type: question.type, points: question.points, options: question.options })), input.answers);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) throw new AppError('Test urinishi bir vaqtda boshqa so‘rovda yuborildi.', 409, 'QUIZ_ATTEMPT_CONFLICT');
      throw error;
    }
    if (!result) throw new AppError('Test urinishi yuborilmadi.', 409, 'QUIZ_ATTEMPT_CONFLICT');
    return mapAttempt(result);
  }

  async latestResult(enrollmentId: string, lessonId: string, actor: LearningActor) {
    await this.studentEnrollment(enrollmentId, lessonId, actor);
    return this.repository.latestResult(enrollmentId, lessonId);
  }

  async submitPractice(enrollmentId: string, lessonId: string, practiceId: string, answer: string, actor: LearningActor) {
    await this.studentEnrollment(enrollmentId, lessonId, actor);
    const practice = await this.repository.findInteractivePractice(lessonId, practiceId);
    if (!practice) throw new AppError('Mashq topilmadi.', 404, 'PRACTICE_NOT_FOUND');
    const correct = practice.answer.trim().toLocaleLowerCase('tr-TR') === answer.trim().toLocaleLowerCase('tr-TR');
    return { practiceId, correct, explanation: practice.explanation, ...(correct ? {} : { correctAnswer: practice.answer }) };
  }

  async teacherResults(courseId: string, lessonId: string, actor: LearningActor) {
    const lesson = await this.managedLesson(courseId, lessonId, actor);
    requirePermission(actor, 'progress.course.read');
    const rows = await this.repository.teacherResults(lesson.course.id, lessonId);
    return rows.map(({ enrollment, attempt }) => ({
      student: { id: enrollment.student.id, name: enrollment.student.displayName ?? ([enrollment.student.firstName, enrollment.student.lastName].filter(Boolean).join(' ') || enrollment.student.email), email: enrollment.student.email },
      score: attempt?.score ?? null,
      maxScore: attempt?.maxScore ?? null,
      percentage: attempt?.percentage ?? null,
      submittedAt: attempt?.submittedAt ?? null,
    }));
  }
}
