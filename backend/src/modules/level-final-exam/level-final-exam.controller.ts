import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { finalExamAttemptParamsSchema, finalExamEnrollmentParamsSchema, finalExamSubmitSchema } from './level-final-exam.schemas.js';
import type { LevelFinalExamService } from './level-final-exam.service.js';

function principal(request: Request): AuthenticatedPrincipal {
  const value = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!value) throw new AppError('Davom etish uchun tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED');
  return value;
}

export class LevelFinalExamController {
  constructor(private readonly service: LevelFinalExamService) {}
  gates = async (request: Request, response: Response) => { response.json({ success: true, message: 'Level kirish holati olindi.', data: await this.service.gates(principal(request)) }); };
  status = async (request: Request, response: Response) => { const p = finalExamEnrollmentParamsSchema.parse(request.params); response.json({ success: true, message: 'Yakuniy imtihon holati olindi.', data: await this.service.status(p.enrollmentId, principal(request)) }); };
  start = async (request: Request, response: Response) => { const p = finalExamEnrollmentParamsSchema.parse(request.params); response.status(201).json({ success: true, message: 'Yakuniy imtihon boshlandi.', data: await this.service.start(p.enrollmentId, principal(request)) }); };
  submit = async (request: Request, response: Response) => { const p = finalExamAttemptParamsSchema.parse(request.params); response.json({ success: true, message: 'Yakuniy imtihon yuborildi.', data: await this.service.submit(p.enrollmentId, p.attemptId, finalExamSubmitSchema.parse(request.body).answers, principal(request)) }); };
}
