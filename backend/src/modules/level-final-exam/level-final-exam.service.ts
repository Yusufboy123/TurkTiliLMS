import { CourseLevel, RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { PrismaLevelGate } from './level-gate.js';
import type { LevelFinalExamActor, LevelFinalExamQuestion, LevelFinalExamStatus } from './level-final-exam.types.js';
import type { InternalFinalExamQuestion, LevelFinalExamRepository } from './level-final-exam.repository.js';

function requireStudent(actor: LevelFinalExamActor): void {
  if (!actor.roles.includes(RoleCode.STUDENT)) throw new AppError('Bu amal faqat student uchun.', 403, 'ACCESS_DENIED');
}

function notFound(): AppError { return new AppError('Yakuniy imtihon topilmadi.', 404, 'FINAL_EXAM_NOT_FOUND'); }

function publicQuestion(question: InternalFinalExamQuestion): LevelFinalExamQuestion {
  return { id: question.id, type: question.sourceQuestion.type, prompt: question.sourceQuestion.prompt, points: question.sourceQuestion.points, position: question.position, options: question.sourceQuestion.type === 'MISSING_WORD' ? [] : question.sourceQuestion.options.map(({ id, text, position }) => ({ id, text, position })) };
}

export class LevelFinalExamService {
  constructor(private readonly repository: LevelFinalExamRepository, private readonly levelGate: PrismaLevelGate) {}

  async gates(actor: LevelFinalExamActor) {
    requireStudent(actor);
    return Promise.all(Object.values(CourseLevel).map((level) => this.levelGate.evaluate(level, actor.userId)));
  }

  private async enrollment(enrollmentId: string, actor: LevelFinalExamActor) {
    requireStudent(actor);
    const enrollment = await this.repository.findEnrollment(enrollmentId, actor.userId);
    if (!enrollment || !enrollment.course.level) throw new AppError('Kurs enrollment’i topilmadi yoki unga kirish mumkin emas.', 403, 'ENROLLMENT_ACCESS_DENIED');
    if (!(await this.levelGate.canAccessCourse(enrollment.courseId, actor.userId))) throw new AppError('Avvalgi level yakuniy imtihonini topshiring.', 403, 'LEVEL_GATE_LOCKED');
    return enrollment;
  }

  async status(enrollmentId: string, actor: LevelFinalExamActor): Promise<LevelFinalExamStatus> {
    const enrollment = await this.enrollment(enrollmentId, actor);
    const exam = await this.repository.findExam(enrollment.course.level);
    if (!exam) return { exam: null, eligible: false, lessonsTotal: 0, lessonsMastered: 0, remainingRequirements: ['Bu level yakuniy imtihoni hali tayyor emas.'], latestResult: null };
    const lessons = await this.levelGate.evaluateCourseLessons(enrollment.courseId, enrollment.id);
    const latestResult = await this.repository.latestResult(exam.id, enrollment.id);
    return { exam, eligible: lessons.total > 0 && lessons.total === lessons.mastered, lessonsTotal: lessons.total, lessonsMastered: lessons.mastered, remainingRequirements: lessons.remaining, latestResult };
  }

  async start(enrollmentId: string, actor: LevelFinalExamActor) {
    const enrollment = await this.enrollment(enrollmentId, actor);
    const exam = await this.repository.findExam(enrollment.course.level);
    if (!exam) throw notFound();
    const lessons = await this.levelGate.evaluateCourseLessons(enrollment.courseId, enrollment.id);
    if (lessons.total === 0 || lessons.total !== lessons.mastered) throw new AppError(lessons.remaining[0] ?? 'Barcha darslarni avval o‘zlashtiring.', 409, 'FINAL_EXAM_NOT_ELIGIBLE');
    if (await this.repository.countFailedToday(exam.id, enrollment.id, exam.passingPercentage) >= 3) throw new AppError('Bugungi yakuniy imtihon urinishlari tugadi. Ertaga yana urinib ko‘ring.', 429, 'FINAL_EXAM_DAILY_LIMIT_REACHED');
    const existing = await this.repository.findOpenAttempt(exam.id, enrollment.id);
    if (existing) return { attempt: existing, questions: (await this.repository.listQuestions(exam.id)).map(publicQuestion) };
    const questions = await this.repository.listQuestions(exam.id);
    if (questions.length !== exam.questionCount || questions.length === 0) throw new AppError('Yakuniy imtihon savollari to‘liq tayyorlanmagan.', 409, 'FINAL_EXAM_INVALID');
    const attempt = await this.repository.createAttempt(exam.id, enrollment.id, questions.reduce((sum, question) => sum + question.sourceQuestion.points, 0));
    return { attempt, questions: questions.map(publicQuestion) };
  }

  async submit(enrollmentId: string, attemptId: string, input: Array<{ questionId: string; submittedAnswer: string }>, actor: LevelFinalExamActor) {
    const enrollment = await this.enrollment(enrollmentId, actor);
    const exam = await this.repository.findExam(enrollment.course.level);
    if (!exam) throw notFound();
    const attempt = await this.repository.findAttempt(attemptId, exam.id, enrollment.id);
    if (!attempt) throw new AppError('Yakuniy imtihon urinishi topilmadi.', 404, 'FINAL_EXAM_ATTEMPT_NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') throw new AppError('Bu yakuniy imtihon allaqachon yuborilgan.', 409, 'FINAL_EXAM_ATTEMPT_SUBMITTED');
    const questions = await this.repository.listQuestions(exam.id);
    const ids = new Set(questions.map((question) => question.id));
    if (input.length !== questions.length || new Set(input.map((answer) => answer.questionId)).size !== input.length || input.some((answer) => !ids.has(answer.questionId))) throw new AppError('Yakuniy imtihon javoblari to‘liq emas.', 422, 'FINAL_EXAM_ANSWERS_INVALID');
    const result = await this.repository.submitAttempt(attemptId, questions.map((question) => ({ id: question.id, type: question.sourceQuestion.type, points: question.sourceQuestion.points, options: question.sourceQuestion.options })), input);
    if (!result) throw new AppError('Yakuniy imtihon bir vaqtda boshqa so‘rovda yuborildi.', 409, 'FINAL_EXAM_ATTEMPT_CONFLICT');
    return result;
  }
}
