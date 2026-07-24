import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import type { MediaController } from './media.controller.js';
import { mediaController, mediaUploadMiddleware } from './media.container.js';

interface MediaRouterDependencies {
  controller: MediaController;
  uploadMiddleware: RequestHandler;
  authenticationMiddleware: RequestHandler;
  managementRoleMiddleware: RequestHandler;
  permissionMiddleware: (...permissions: string[]) => RequestHandler;
}

export function createMediaRouter(dependencies: MediaRouterDependencies): Router {
  const router = Router();
  router.use(dependencies.authenticationMiddleware);
  router.use(dependencies.managementRoleMiddleware);

  router.post(
    '/upload',
    dependencies.permissionMiddleware('media.upload'),
    dependencies.uploadMiddleware,
    asyncHandler(dependencies.controller.upload),
  );
  router.get(
    '/:id',
    dependencies.permissionMiddleware('media.read'),
    asyncHandler(dependencies.controller.getById),
  );
  router.get(
    '/:id/usages',
    dependencies.permissionMiddleware('media.read'),
    asyncHandler(dependencies.controller.usages),
  );
  router.get(
    '/:id/download',
    dependencies.permissionMiddleware('media.download'),
    asyncHandler(dependencies.controller.download),
  );
  router.delete(
    '/:id',
    dependencies.permissionMiddleware('media.delete'),
    asyncHandler(dependencies.controller.delete),
  );
  router.post(
    '/:id/restore',
    dependencies.permissionMiddleware('media.restore'),
    asyncHandler(dependencies.controller.restore),
  );

  return router;
}

export const mediaRouter = createMediaRouter({
  controller: mediaController,
  uploadMiddleware: mediaUploadMiddleware,
  authenticationMiddleware: requireAuthentication,
  managementRoleMiddleware: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  permissionMiddleware: requirePermission,
});
