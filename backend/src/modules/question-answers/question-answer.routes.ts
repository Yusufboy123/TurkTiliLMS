import { RoleCode } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requireRole } from '../authorization/authorization.middleware.js';
import { QuestionAnswerController } from './question-answer.controller.js';
import { PrismaQuestionAnswerRepository } from './question-answer.repository.js';
import { QuestionAnswerService } from './question-answer.service.js';

const controller = new QuestionAnswerController(new QuestionAnswerService(new PrismaQuestionAnswerRepository()));
export const questionAnswerRouter = Router();
questionAnswerRouter.use(requireAuthentication);
questionAnswerRouter.get('/me/questions', requireRole(RoleCode.STUDENT), asyncHandler(controller.studentList));
questionAnswerRouter.post('/me/questions', requireRole(RoleCode.STUDENT), asyncHandler(controller.create));
questionAnswerRouter.get('/me/questions/:threadId', requireRole(RoleCode.STUDENT), asyncHandler(controller.studentDetail));
questionAnswerRouter.post('/me/questions/:threadId/messages', requireRole(RoleCode.STUDENT), asyncHandler(controller.studentMessage));
questionAnswerRouter.get('/teacher/questions', requireRole(RoleCode.TEACHER), asyncHandler(controller.teacherList));
questionAnswerRouter.get('/teacher/questions/:threadId', requireRole(RoleCode.TEACHER), asyncHandler(controller.teacherDetail));
questionAnswerRouter.post('/teacher/questions/:threadId/messages', requireRole(RoleCode.TEACHER), asyncHandler(controller.teacherMessage));
questionAnswerRouter.patch('/teacher/questions/:threadId/status', requireRole(RoleCode.TEACHER), asyncHandler(controller.status));
