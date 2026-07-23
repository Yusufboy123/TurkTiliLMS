import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { userManagementService } from './user-management.container.js';
import { UserManagementController } from './user-management.controller.js';

interface UserManagementRouterDependencies {
  controller: UserManagementController;
  authenticationMiddleware: RequestHandler;
  adminRoleMiddleware: RequestHandler;
  permissionMiddleware: (...permissions: string[]) => RequestHandler;
}

export function createUserManagementRouter(dependencies: UserManagementRouterDependencies): Router {
  const router = Router();

  router.use(dependencies.authenticationMiddleware, dependencies.adminRoleMiddleware);
  router.get(
    '/statistics',
    dependencies.permissionMiddleware('users.read'),
    asyncHandler(dependencies.controller.statistics),
  );
  router.get(
    '/',
    dependencies.permissionMiddleware('users.read'),
    asyncHandler(dependencies.controller.list),
  );
  router.get(
    '/:userId',
    dependencies.permissionMiddleware('users.read'),
    asyncHandler(dependencies.controller.getById),
  );
  router.post(
    '/',
    dependencies.permissionMiddleware('users.create', 'roles.assign'),
    asyncHandler(dependencies.controller.create),
  );
  router.patch(
    '/:userId',
    dependencies.permissionMiddleware('users.update'),
    asyncHandler(dependencies.controller.update),
  );
  router.patch('/:userId/status', asyncHandler(dependencies.controller.updateStatus));
  router.put(
    '/:userId/roles',
    dependencies.permissionMiddleware('roles.assign'),
    asyncHandler(dependencies.controller.replaceRoles),
  );
  router.delete(
    '/:userId',
    dependencies.permissionMiddleware('users.delete'),
    asyncHandler(dependencies.controller.delete),
  );
  router.post(
    '/:userId/restore',
    dependencies.permissionMiddleware('users.restore'),
    asyncHandler(dependencies.controller.restore),
  );

  return router;
}

export const userManagementRouter = createUserManagementRouter({
  controller: new UserManagementController(userManagementService),
  authenticationMiddleware: requireAuthentication,
  adminRoleMiddleware: requireRole(RoleCode.ADMIN),
  permissionMiddleware: requirePermission,
});
