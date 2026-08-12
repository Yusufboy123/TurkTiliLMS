import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { createQuestionSchema, messageSchema, questionQuerySchema, questionThreadIdSchema, threadStatusSchema } from './question-answer.schemas.js';
import type { QuestionAnswerService } from './question-answer.service.js';

function actor(req: Request) { const auth = (req as Request & { auth?: AuthenticatedPrincipal }).auth; if (!auth) throw new AppError('Kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED'); return { userId: auth.userId, roles: auth.roles, permissions: auth.permissions }; }
export class QuestionAnswerController {
  constructor(private readonly service: QuestionAnswerService) {}
  studentList = async (req: Request, res: Response): Promise<void> => { const query = questionQuerySchema.parse(req.query); res.json({ success: true, message: 'Savollar olindi.', data: await this.service.studentList(actor(req), { page: query.page, pageSize: query.pageSize, ...(query.status ? { status: query.status } : {}) }) }); };
  studentDetail = async (req: Request, res: Response): Promise<void> => { res.json({ success: true, message: 'Savol olindi.', data: await this.service.studentDetail(actor(req), questionThreadIdSchema.parse(req.params).threadId) }); };
  create = async (req: Request, res: Response): Promise<void> => { res.status(201).json({ success: true, message: 'Savol yuborildi.', data: await this.service.create(actor(req), createQuestionSchema.parse(req.body)) }); };
  studentMessage = async (req: Request, res: Response): Promise<void> => { res.status(201).json({ success: true, message: 'Xabar yuborildi.', data: await this.service.studentMessage(actor(req), questionThreadIdSchema.parse(req.params).threadId, messageSchema.parse(req.body)) }); };
  teacherList = async (req: Request, res: Response): Promise<void> => { const query = questionQuerySchema.parse(req.query); res.json({ success: true, message: 'Savollar olindi.', data: await this.service.teacherList(actor(req), { page: query.page, pageSize: query.pageSize, ...(query.status ? { status: query.status } : {}) }) }); };
  teacherDetail = async (req: Request, res: Response): Promise<void> => { res.json({ success: true, message: 'Savol olindi.', data: await this.service.teacherDetail(actor(req), questionThreadIdSchema.parse(req.params).threadId) }); };
  teacherMessage = async (req: Request, res: Response): Promise<void> => { res.status(201).json({ success: true, message: 'Javob yuborildi.', data: await this.service.teacherMessage(actor(req), questionThreadIdSchema.parse(req.params).threadId, messageSchema.parse(req.body)) }); };
  status = async (req: Request, res: Response): Promise<void> => { res.json({ success: true, message: 'Savol holati yangilandi.', data: await this.service.status(actor(req), questionThreadIdSchema.parse(req.params).threadId, threadStatusSchema.parse(req.body)) }); };
}
