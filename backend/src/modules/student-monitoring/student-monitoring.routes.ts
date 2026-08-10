import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { studentMonitoringService } from './student-monitoring.container.js';
import { StudentMonitoringController } from './student-monitoring.controller.js';

export function createStudentMonitoringRouter(
  controller: StudentMonitoringController,
  authentication: RequestHandler,
  managementRole: RequestHandler,
  permission: (...permissions: string[]) => RequestHandler,
): Router {
  const router = Router();
  router.use(authentication, managementRole, permission('progress.course.read'));
  router.get('/', asyncHandler(controller.list));
  router.get('/:studentId', asyncHandler(controller.getById));
  return router;
}

export const studentMonitoringRouter = createStudentMonitoringRouter(
  new StudentMonitoringController(studentMonitoringService),
  requireAuthentication,
  requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  requirePermission,
);
