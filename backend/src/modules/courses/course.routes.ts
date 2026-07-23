import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { courseService } from './course.container.js';
import { CourseController } from './course.controller.js';

interface CourseRouterDependencies {
  controller: CourseController;
  authenticationMiddleware: RequestHandler;
  managementRoleMiddleware: RequestHandler;
  adminRoleMiddleware: RequestHandler;
  permissionMiddleware: (...permissions: string[]) => RequestHandler;
}

export function createCourseRouter(dependencies: CourseRouterDependencies): Router {
  const router = Router();

  router.use(dependencies.authenticationMiddleware);
  router.get(
    '/statistics',
    dependencies.adminRoleMiddleware,
    dependencies.permissionMiddleware('courses.view_statistics'),
    asyncHandler(dependencies.controller.statistics),
  );
  router.get(
    '/',
    dependencies.managementRoleMiddleware,
    dependencies.permissionMiddleware('courses.read'),
    asyncHandler(dependencies.controller.list),
  );
  router.get(
    '/:courseId',
    dependencies.managementRoleMiddleware,
    dependencies.permissionMiddleware('courses.read'),
    asyncHandler(dependencies.controller.getById),
  );
  router.post(
    '/',
    dependencies.managementRoleMiddleware,
    dependencies.permissionMiddleware('courses.create'),
    asyncHandler(dependencies.controller.create),
  );
  router.patch(
    '/:courseId',
    dependencies.managementRoleMiddleware,
    dependencies.permissionMiddleware('courses.update'),
    asyncHandler(dependencies.controller.update),
  );
  router.patch(
    '/:courseId/status',
    dependencies.managementRoleMiddleware,
    asyncHandler(dependencies.controller.updateStatus),
  );
  router.patch(
    '/:courseId/teacher',
    dependencies.adminRoleMiddleware,
    dependencies.permissionMiddleware('courses.assign_teacher'),
    asyncHandler(dependencies.controller.assignTeacher),
  );
  router.delete(
    '/:courseId',
    dependencies.managementRoleMiddleware,
    dependencies.permissionMiddleware('courses.delete'),
    asyncHandler(dependencies.controller.delete),
  );
  router.post(
    '/:courseId/restore',
    dependencies.managementRoleMiddleware,
    dependencies.permissionMiddleware('courses.restore'),
    asyncHandler(dependencies.controller.restore),
  );

  return router;
}

export function createCourseCatalogRouter(controller: CourseController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.listCatalog));
  router.get('/:slug', asyncHandler(controller.getCatalogBySlug));
  return router;
}

const courseController = new CourseController(courseService);

export const courseRouter = createCourseRouter({
  controller: courseController,
  authenticationMiddleware: requireAuthentication,
  managementRoleMiddleware: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  adminRoleMiddleware: requireRole(RoleCode.ADMIN),
  permissionMiddleware: requirePermission,
});

export const courseCatalogRouter = createCourseCatalogRouter(courseController);
