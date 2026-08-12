import { RoleCode } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requireRole } from '../authorization/authorization.middleware.js';
import { NotificationController } from './notification.controller.js';
import { PrismaNotificationRepository } from './notification.repository.js';
import { NotificationService } from './notification.service.js';

const controller = new NotificationController(new NotificationService(new PrismaNotificationRepository()));
export const notificationRouter = Router();
notificationRouter.use(requireAuthentication);
notificationRouter.get('/me/notifications', asyncHandler(controller.list));
notificationRouter.patch('/me/notifications/:notificationId/read', asyncHandler(controller.markRead));
notificationRouter.post('/me/notifications/read-all', asyncHandler(controller.markAllRead));
notificationRouter.post('/admin/announcements', requireRole(RoleCode.ADMIN), asyncHandler(controller.announce));
