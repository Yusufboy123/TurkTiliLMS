import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requirePermission, requireRole } from '../authorization/authorization.middleware.js';
import { AdminActivityController } from './admin-activity.controller.js';
import { PrismaAdminActivityRepository } from './admin-activity.repository.js';
import { AdminActivityService } from './admin-activity.service.js';

interface AdminActivityRouteDependencies {
  readonly controller: AdminActivityController;
  readonly authentication: RequestHandler;
  readonly adminRole: RequestHandler;
  readonly permission: (...permissions: string[]) => RequestHandler;
}

export function createAdminActivityRouter(dependencies: AdminActivityRouteDependencies): Router {
  const router = Router();
  router.get(
    '/admin/activity',
    dependencies.authentication,
    dependencies.adminRole,
    dependencies.permission('audit.read'),
    asyncHandler(dependencies.controller.list),
  );
  return router;
}

const controller = new AdminActivityController(new AdminActivityService(new PrismaAdminActivityRepository()));

export const adminActivityRouter = createAdminActivityRouter({
  controller,
  authentication: requireAuthentication,
  adminRole: requireRole(RoleCode.ADMIN),
  permission: requirePermission,
});
