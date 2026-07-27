import { RoleCode } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { progressReportingController } from './progress-reporting.container.js';
import type { ProgressReportingController } from './progress-reporting.controller.js';

const reportingRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Juda ko‘p so‘rov yuborildi. Birozdan so‘ng qayta urinib ko‘ring.',
  },
});

interface ProgressReportingRouterDependencies {
  controller: ProgressReportingController;
  authentication: RequestHandler;
  teacherOrAdminRole: RequestHandler;
  adminRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
  rateLimiter: RequestHandler;
}

export function createProgressReportingRouter(
  dependencies: ProgressReportingRouterDependencies,
): Router {
  const router = Router();
  router.get(
    '/courses/:courseId/progress',
    dependencies.authentication,
    dependencies.teacherOrAdminRole,
    dependencies.permission('progress.course.read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.listTeacherCourse),
  );
  router.get(
    '/courses/:courseId/progress/enrollments/:enrollmentId',
    dependencies.authentication,
    dependencies.teacherOrAdminRole,
    dependencies.permission('progress.course.read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.getTeacherEnrollment),
  );
  router.get(
    '/progress',
    dependencies.authentication,
    dependencies.adminRole,
    dependencies.permission('progress.read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.listAdmin),
  );
  router.get(
    '/progress/enrollments/:enrollmentId',
    dependencies.authentication,
    dependencies.adminRole,
    dependencies.permission('progress.read'),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.getAdminEnrollment),
  );
  return router;
}

export const progressReportingRouter = createProgressReportingRouter({
  controller: progressReportingController,
  authentication: requireAuthentication,
  teacherOrAdminRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  adminRole: requireRole(RoleCode.ADMIN),
  permission: requirePermission,
  rateLimiter: reportingRateLimiter,
});
