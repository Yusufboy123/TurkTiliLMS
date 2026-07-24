import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  optionalAuthentication,
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { lessonContentBlockService } from './lesson-content-block.container.js';
import { LessonContentBlockController } from './lesson-content-block.controller.js';

interface LessonContentBlockRouteDependencies {
  controller: LessonContentBlockController;
  authentication: RequestHandler;
  managementRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
}

export function createLessonContentBlockRouter(
  dependencies: LessonContentBlockRouteDependencies,
): Router {
  const router = Router({ mergeParams: true });
  router.use(dependencies.authentication, dependencies.managementRole);
  router.get(
    '/',
    dependencies.permission('lesson_blocks.read'),
    asyncHandler(dependencies.controller.list),
  );
  router.get(
    '/:blockId',
    dependencies.permission('lesson_blocks.read'),
    asyncHandler(dependencies.controller.detail),
  );
  router.post(
    '/',
    dependencies.permission('lesson_blocks.create'),
    asyncHandler(dependencies.controller.create),
  );
  router.patch(
    '/:blockId',
    dependencies.permission('lesson_blocks.update'),
    asyncHandler(dependencies.controller.update),
  );
  router.patch(
    '/:blockId/position',
    dependencies.permission('lesson_blocks.reorder'),
    asyncHandler(dependencies.controller.reorder),
  );
  router.patch(
    '/:blockId/visibility',
    dependencies.permission('lesson_blocks.manage_visibility'),
    asyncHandler(dependencies.controller.updateVisibility),
  );
  router.delete(
    '/:blockId',
    dependencies.permission('lesson_blocks.delete'),
    asyncHandler(dependencies.controller.delete),
  );
  router.post(
    '/:blockId/restore',
    dependencies.permission('lesson_blocks.restore'),
    asyncHandler(dependencies.controller.restore),
  );
  return router;
}

export function createLessonContentBlockCatalogRouter(
  controller: LessonContentBlockController,
  optionalAuth: RequestHandler,
): Router {
  const router = Router({ mergeParams: true });
  router.get(
    '/:courseSlug/lessons/:lessonSlug/blocks',
    optionalAuth,
    asyncHandler(controller.catalog),
  );
  return router;
}

const controller = new LessonContentBlockController(lessonContentBlockService);

export const lessonContentBlockRouter = createLessonContentBlockRouter({
  controller,
  authentication: requireAuthentication,
  managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  permission: requirePermission,
});

export const lessonContentBlockCatalogRouter = createLessonContentBlockCatalogRouter(
  controller,
  optionalAuthentication,
);
