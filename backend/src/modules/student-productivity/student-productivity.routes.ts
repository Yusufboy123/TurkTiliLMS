import { RoleCode } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requireRole } from '../authorization/authorization.middleware.js';
import { PrismaStudentProductivityRepository } from './student-productivity.repository.js';
import { StudentProductivityController } from './student-productivity.controller.js';
import { StudentProductivityService } from './student-productivity.service.js';

const controller = new StudentProductivityController(new StudentProductivityService(new PrismaStudentProductivityRepository()));
export const studentProductivityRouter = Router();
const studentOnly = [requireAuthentication, requireRole(RoleCode.STUDENT)] as const;
studentProductivityRouter.get('/me/bookmarks', ...studentOnly, asyncHandler(controller.listBookmarks));
studentProductivityRouter.post('/me/bookmarks', ...studentOnly, asyncHandler(controller.createBookmark));
studentProductivityRouter.delete('/me/bookmarks/:bookmarkId', ...studentOnly, asyncHandler(controller.deleteBookmark));
studentProductivityRouter.get('/me/lessons/:lessonId/note', ...studentOnly, asyncHandler(controller.getNote));
studentProductivityRouter.put('/me/lessons/:lessonId/note', ...studentOnly, asyncHandler(controller.saveNote));
studentProductivityRouter.delete('/me/lessons/:lessonId/note', ...studentOnly, asyncHandler(controller.deleteNote));
