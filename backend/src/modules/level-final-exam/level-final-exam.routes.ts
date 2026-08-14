import { RoleCode } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requirePermission, requireRole } from '../authorization/authorization.middleware.js';
import { levelFinalExamController } from './level-final-exam.container.js';

export const levelFinalExamRouter = Router();
const studentRead = [requireAuthentication, requireRole(RoleCode.STUDENT), requirePermission('progress.self_read')];
const studentWrite = [requireAuthentication, requireRole(RoleCode.STUDENT), requirePermission('progress.self_complete')];
levelFinalExamRouter.get('/enrollments/:enrollmentId/final-exam', ...studentRead, asyncHandler(levelFinalExamController.status));
levelFinalExamRouter.get('/me/level-gates', ...studentRead, asyncHandler(levelFinalExamController.gates));
levelFinalExamRouter.post('/enrollments/:enrollmentId/final-exam/attempts', ...studentWrite, asyncHandler(levelFinalExamController.start));
levelFinalExamRouter.post('/enrollments/:enrollmentId/final-exam/attempts/:attemptId/submit', ...studentWrite, asyncHandler(levelFinalExamController.submit));
