import { RoleCode } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requireRole } from '../authorization/authorization.middleware.js';
import { PrismaStudentProductivityRepository } from './student-productivity.repository.js';
import { StudentProductivityController } from './student-productivity.controller.js';
import { StudentProductivityService } from './student-productivity.service.js';

const controller = new StudentProductivityController(new StudentProductivityService(new PrismaStudentProductivityRepository()));
export const studentProductivityRouter = Router();
studentProductivityRouter.use(requireAuthentication, requireRole(RoleCode.STUDENT));
studentProductivityRouter.get('/me/bookmarks', asyncHandler(controller.listBookmarks));
studentProductivityRouter.post('/me/bookmarks', asyncHandler(controller.createBookmark));
studentProductivityRouter.delete('/me/bookmarks/:bookmarkId', asyncHandler(controller.deleteBookmark));
studentProductivityRouter.get('/me/lessons/:lessonId/note', asyncHandler(controller.getNote));
studentProductivityRouter.put('/me/lessons/:lessonId/note', asyncHandler(controller.saveNote));
studentProductivityRouter.delete('/me/lessons/:lessonId/note', asyncHandler(controller.deleteNote));
