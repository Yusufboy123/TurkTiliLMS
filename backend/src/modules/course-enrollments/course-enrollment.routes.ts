import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { courseEnrollmentController } from './course-enrollment.container.js';
import type { CourseEnrollmentController } from './course-enrollment.controller.js';

interface EnrollmentRouterDependencies {
  controller: CourseEnrollmentController;
  authentication: RequestHandler;
  studentRole: RequestHandler;
  managementRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
}

export function createCourseEnrollmentRouter(dependencies: EnrollmentRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  router.use(dependencies.authentication);
  router.post(
    '/self',
    dependencies.studentRole,
    dependencies.permission('enrollments.self_create'),
    asyncHandler(dependencies.controller.selfEnroll),
  );
  router.get(
    '/',
    dependencies.managementRole,
    dependencies.permission('enrollments.read'),
    asyncHandler(dependencies.controller.listCourse),
  );
  router.post(
    '/',
    dependencies.managementRole,
    dependencies.permission('enrollments.create'),
    asyncHandler(dependencies.controller.createManaged),
  );
  return router;
}

export function createMyEnrollmentRouter(dependencies: EnrollmentRouterDependencies): Router {
  const router = Router();
  router.use(dependencies.authentication, dependencies.studentRole);
  router.get(
    '/',
    dependencies.permission('enrollments.self_read'),
    asyncHandler(dependencies.controller.listOwn),
  );
  router.get(
    '/:enrollmentId',
    dependencies.permission('enrollments.self_read'),
    asyncHandler(dependencies.controller.getOwn),
  );
  router.post(
    '/:enrollmentId/cancel',
    dependencies.permission('enrollments.self_cancel'),
    asyncHandler(dependencies.controller.cancelOwn),
  );
  router.patch(
    '/:enrollmentId/cancel',
    dependencies.permission('enrollments.self_cancel'),
    asyncHandler(dependencies.controller.cancelOwn),
  );
  return router;
}

export function createEnrollmentManagementRouter(
  dependencies: EnrollmentRouterDependencies,
): Router {
  const router = Router();
  router.use(dependencies.authentication, dependencies.managementRole);
  router.get(
    '/:enrollmentId',
    dependencies.permission('enrollments.read'),
    asyncHandler(dependencies.controller.getManaged),
  );
  router.patch(
    '/:enrollmentId/status',
    dependencies.permission('enrollments.update_status'),
    asyncHandler(dependencies.controller.updateStatus),
  );
  return router;
}

const dependencies: EnrollmentRouterDependencies = {
  controller: courseEnrollmentController,
  authentication: requireAuthentication,
  studentRole: requireRole(RoleCode.STUDENT),
  managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  permission: requirePermission,
};

export const courseEnrollmentRouter = createCourseEnrollmentRouter(dependencies);
export const myEnrollmentRouter = createMyEnrollmentRouter(dependencies);
export const enrollmentManagementRouter = createEnrollmentManagementRouter(dependencies);
