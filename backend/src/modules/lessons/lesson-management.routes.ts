import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  optionalAuthentication,
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { lessonManagementService } from './lesson-management.container.js';
import { LessonManagementController } from './lesson-management.controller.js';

interface ManagementRouteDependencies {
  controller: LessonManagementController;
  authentication: RequestHandler;
  managementRole: RequestHandler;
  adminRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
}

export function createSectionRouter(deps: ManagementRouteDependencies): Router {
  const router = Router({ mergeParams: true });
  router.use(deps.authentication, deps.managementRole);
  router.get('/', deps.permission('sections.read'), asyncHandler(deps.controller.listSections));
  router.get(
    '/:sectionId',
    deps.permission('sections.read'),
    asyncHandler(deps.controller.sectionDetail),
  );
  router.post('/', deps.permission('sections.create'), asyncHandler(deps.controller.createSection));
  router.patch(
    '/:sectionId',
    deps.permission('sections.update'),
    asyncHandler(deps.controller.updateSection),
  );
  router.patch(
    '/:sectionId/position',
    deps.permission('sections.reorder'),
    asyncHandler(deps.controller.reorderSection),
  );
  router.delete(
    '/:sectionId',
    deps.permission('sections.delete'),
    asyncHandler(deps.controller.deleteSection),
  );
  router.post(
    '/:sectionId/restore',
    deps.permission('sections.restore'),
    asyncHandler(deps.controller.restoreSection),
  );
  return router;
}

export function createLessonRouter(deps: ManagementRouteDependencies): Router {
  const router = Router({ mergeParams: true });
  router.use(deps.authentication, deps.managementRole);
  router.get(
    '/statistics',
    deps.permission('lessons.view_statistics'),
    asyncHandler(deps.controller.statistics),
  );
  router.get('/', deps.permission('lessons.read'), asyncHandler(deps.controller.listLessons));
  router.get(
    '/:lessonId',
    deps.permission('lessons.read'),
    asyncHandler(deps.controller.lessonDetail),
  );
  router.post('/', deps.permission('lessons.create'), asyncHandler(deps.controller.createLesson));
  router.patch(
    '/:lessonId',
    deps.permission('lessons.update'),
    asyncHandler(deps.controller.updateLesson),
  );
  router.patch('/:lessonId/status', asyncHandler(deps.controller.updateLessonStatus));
  router.patch(
    '/:lessonId/teacher',
    deps.adminRole,
    deps.permission('lessons.assign_teacher'),
    asyncHandler(deps.controller.assignTeacher),
  );
  router.patch(
    '/:lessonId/position',
    deps.permission('lessons.reorder'),
    asyncHandler(deps.controller.reorderLesson),
  );
  router.delete(
    '/:lessonId',
    deps.permission('lessons.delete'),
    asyncHandler(deps.controller.deleteLesson),
  );
  router.post(
    '/:lessonId/restore',
    deps.permission('lessons.restore'),
    asyncHandler(deps.controller.restoreLesson),
  );
  return router;
}

export function createLessonCatalogRouter(
  controller: LessonManagementController,
  optionalAuth: RequestHandler,
): Router {
  const router = Router();
  router.get('/:slug/curriculum', asyncHandler(controller.curriculum));
  router.get(
    '/:courseSlug/lessons/:lessonSlug',
    optionalAuth,
    asyncHandler(controller.catalogLesson),
  );
  return router;
}

const controller = new LessonManagementController(lessonManagementService);
const dependencies: ManagementRouteDependencies = {
  controller,
  authentication: requireAuthentication,
  managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  adminRole: requireRole(RoleCode.ADMIN),
  permission: requirePermission,
};

export const sectionRouter = createSectionRouter(dependencies);
export const lessonRouter = createLessonRouter(dependencies);
export const lessonCatalogRouter = createLessonCatalogRouter(controller, optionalAuthentication);
