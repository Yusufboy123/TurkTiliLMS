import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { progressTrackingController } from './progress-tracking.container.js';
import type { ProgressTrackingController } from './progress-tracking.controller.js';
import {
  blockProgressMutationRateLimiter,
  lessonProgressMutationRateLimiter,
  progressActivityRateLimiter,
} from './progress-tracking.rate-limiters.js';

interface ProgressRouterDependencies {
  controller: ProgressTrackingController;
  authentication: RequestHandler;
  studentRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
  blockMutationLimit: RequestHandler;
  lessonMutationLimit: RequestHandler;
  activityLimit: RequestHandler;
}

export function createProgressTrackingRouter(dependencies: ProgressRouterDependencies): Router {
  const router = Router();
  const studentBoundary = [dependencies.authentication, dependencies.studentRole] as const;

  router.get(
    '/me/progress',
    ...studentBoundary,
    dependencies.permission('progress.self_read'),
    asyncHandler(dependencies.controller.getOwnSummary),
  );
  router.get(
    '/me/progress/completed-courses',
    ...studentBoundary,
    dependencies.permission('progress.self_read'),
    asyncHandler(dependencies.controller.listOwnCompleted),
  );
  router.get(
    '/me/enrollments/:enrollmentId/progress',
    ...studentBoundary,
    dependencies.permission('progress.self_read'),
    asyncHandler(dependencies.controller.getOwnEnrollmentProgress),
  );
  router.get(
    '/me/enrollments/:enrollmentId/progress/resume',
    ...studentBoundary,
    dependencies.permission('progress.self_read'),
    asyncHandler(dependencies.controller.getOwnResumeTarget),
  );
  router.post(
    '/me/enrollments/:enrollmentId/progress/blocks/:blockId/complete',
    ...studentBoundary,
    dependencies.blockMutationLimit,
    dependencies.permission('progress.self_complete'),
    asyncHandler(dependencies.controller.completeBlock),
  );
  router.post(
    '/me/enrollments/:enrollmentId/progress/blocks/:blockId/reopen',
    ...studentBoundary,
    dependencies.blockMutationLimit,
    dependencies.permission('progress.self_reopen'),
    asyncHandler(dependencies.controller.reopenBlock),
  );
  router.post(
    '/me/enrollments/:enrollmentId/progress/lessons/:lessonId/complete',
    ...studentBoundary,
    dependencies.lessonMutationLimit,
    dependencies.permission('progress.self_complete'),
    asyncHandler(dependencies.controller.completeLesson),
  );
  router.post(
    '/me/enrollments/:enrollmentId/progress/lessons/:lessonId/reopen',
    ...studentBoundary,
    dependencies.lessonMutationLimit,
    dependencies.permission('progress.self_reopen'),
    asyncHandler(dependencies.controller.reopenLesson),
  );
  router.put(
    '/me/enrollments/:enrollmentId/progress/last-visited-lesson',
    ...studentBoundary,
    dependencies.activityLimit,
    dependencies.permission('progress.self_record_visit'),
    asyncHandler(dependencies.controller.recordLastVisitedLesson),
  );
  return router;
}

const dependencies: ProgressRouterDependencies = {
  controller: progressTrackingController,
  authentication: requireAuthentication,
  studentRole: requireRole(RoleCode.STUDENT),
  permission: requirePermission,
  blockMutationLimit: blockProgressMutationRateLimiter,
  lessonMutationLimit: lessonProgressMutationRateLimiter,
  activityLimit: progressActivityRateLimiter,
};

export const progressTrackingRouter = createProgressTrackingRouter(dependencies);
