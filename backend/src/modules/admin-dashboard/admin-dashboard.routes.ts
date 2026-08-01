import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { adminDashboardController, adminDashboardService } from './admin-dashboard.container.js';
import type { AdminDashboardController } from './admin-dashboard.controller.js';
import {
  adminDashboardNoStore,
  createAdminDashboardRateLimitMiddleware,
} from './admin-dashboard.rate-limit.js';
import { adminDashboardRequiredPermissions } from './admin-dashboard.types.js';

interface AdminDashboardRouterDependencies {
  readonly controller: AdminDashboardController;
  readonly noStore: RequestHandler;
  readonly authentication: RequestHandler;
  readonly adminRole: RequestHandler;
  readonly permission: (...permissions: string[]) => RequestHandler;
  readonly rateLimiter: RequestHandler;
}

export function createAdminDashboardRouter(dependencies: AdminDashboardRouterDependencies): Router {
  const router = Router();
  router.get(
    '/admin/dashboard/summary',
    dependencies.noStore,
    dependencies.authentication,
    dependencies.adminRole,
    dependencies.permission(...adminDashboardRequiredPermissions),
    dependencies.rateLimiter,
    asyncHandler(dependencies.controller.summary),
  );
  return router;
}

export const adminDashboardRouter = createAdminDashboardRouter({
  controller: adminDashboardController,
  noStore: adminDashboardNoStore,
  authentication: requireAuthentication,
  adminRole: requireRole(RoleCode.ADMIN),
  permission: requirePermission,
  rateLimiter: createAdminDashboardRateLimitMiddleware(adminDashboardService),
});
