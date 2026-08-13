import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { vocabularyAttemptParamsSchema, vocabularyParamsSchema, vocabularyStatusSchema, vocabularySubmitSchema } from './vocabulary-learning.schemas.js';
import type { VocabularyLearningService } from './vocabulary-learning.service.js';

function actor(request: Request): AuthenticatedPrincipal { const principal = (request as Request & { auth?: AuthenticatedPrincipal }).auth; if (!principal) throw new AppError('Davom etish uchun tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED'); return principal; }
export class VocabularyLearningController {
  constructor(private readonly service: VocabularyLearningService) {}
  learning = async (req: Request, res: Response) => { const p = vocabularyParamsSchema.parse(req.params); res.json({ success: true, message: 'Lug‘at olindi.', data: await this.service.learning(p.enrollmentId, p.lessonId, actor(req)) }); };
  status = async (req: Request, res: Response) => { const p = vocabularyParamsSchema.extend({ vocabularyId: vocabularyParamsSchema.shape.lessonId }).parse(req.params); res.json({ success: true, message: 'Lug‘at holati saqlandi.', data: await this.service.status(p.enrollmentId, p.lessonId, p.vocabularyId, vocabularyStatusSchema.parse(req.body).status, actor(req)) }); };
  test = async (req: Request, res: Response) => { const p = vocabularyParamsSchema.parse(req.params); res.json({ success: true, message: 'Lug‘at testi olindi.', data: await this.service.test(p.enrollmentId, p.lessonId, actor(req)) }); };
  start = async (req: Request, res: Response) => { const p = vocabularyParamsSchema.parse(req.params); res.status(201).json({ success: true, message: 'Lug‘at testi boshlandi.', data: await this.service.start(p.enrollmentId, p.lessonId, actor(req)) }); };
  submit = async (req: Request, res: Response) => { const p = vocabularyAttemptParamsSchema.parse(req.params); res.json({ success: true, message: 'Lug‘at testi yuborildi.', data: await this.service.submit(p.enrollmentId, p.lessonId, p.attemptId, vocabularySubmitSchema.parse(req.body).answers, actor(req)) }); };
  latest = async (req: Request, res: Response) => { const p = vocabularyParamsSchema.parse(req.params); res.json({ success: true, message: 'Lug‘at natijasi olindi.', data: await this.service.latest(p.enrollmentId, p.lessonId, actor(req)) }); };
}
