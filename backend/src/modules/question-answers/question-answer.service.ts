import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { CreateQuestionInput, QuestionMessageInput, ThreadStatusInput } from './question-answer.schemas.js';
import type { QuestionAnswerRepository } from './question-answer.repository.js';
import type { QuestionAnswerActor, QuestionThreadQuery } from './question-answer.types.js';

function student(actor: QuestionAnswerActor) { if (!actor.roles.includes(RoleCode.STUDENT)) throw new AppError('Bu amal faqat student uchun.', 403, 'ACCESS_DENIED'); }
function teacher(actor: QuestionAnswerActor) { if (!actor.roles.includes(RoleCode.TEACHER)) throw new AppError('Bu amal faqat o‘qituvchi uchun.', 403, 'ACCESS_DENIED'); }
function notFound() { return new AppError('Savol topilmadi.', 404, 'QUESTION_THREAD_NOT_FOUND'); }

export class QuestionAnswerService {
  constructor(private readonly repository: QuestionAnswerRepository) {}
  async studentList(actor: QuestionAnswerActor, query: QuestionThreadQuery) { student(actor); const result = await this.repository.listForStudent(actor.userId, query); return { ...result, pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }; }
  async teacherList(actor: QuestionAnswerActor, query: QuestionThreadQuery) { teacher(actor); const result = await this.repository.listForTeacher(actor.userId, query); return { ...result, pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }; }
  async studentDetail(actor: QuestionAnswerActor, id: string) { student(actor); const result = await this.repository.findForStudent(actor.userId, id); if (!result) throw notFound(); return result; }
  async teacherDetail(actor: QuestionAnswerActor, id: string) { teacher(actor); const result = await this.repository.findForTeacher(actor.userId, id); if (!result) throw notFound(); return result; }
  async create(actor: QuestionAnswerActor, input: CreateQuestionInput) { student(actor); const result = await this.repository.createStudentQuestion(actor.userId, input); if (!result) throw new AppError('Savol yuborish uchun faol kurs yoziluvi kerak.', 403, 'QUESTION_ACCESS_DENIED'); return result; }
  async studentMessage(actor: QuestionAnswerActor, id: string, input: QuestionMessageInput) { student(actor); const result = await this.repository.addStudentMessage(actor.userId, id, input); if (!result) throw new AppError('Savol yopilgan yoki kursga kirish muddati tugagan.', 403, 'QUESTION_MESSAGE_DENIED'); return result; }
  async teacherMessage(actor: QuestionAnswerActor, id: string, input: QuestionMessageInput) { teacher(actor); const result = await this.repository.addTeacherMessage(actor.userId, id, input); if (!result) throw new AppError('Savol yopilgan yoki sizga tegishli emas.', 403, 'QUESTION_MESSAGE_DENIED'); return result; }
  async status(actor: QuestionAnswerActor, id: string, input: ThreadStatusInput) { teacher(actor); const result = await this.repository.setTeacherStatus(actor.userId, id, input); if (!result) throw notFound(); return result; }
}
