import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requirePermission, requireRole } from '../authorization/authorization.middleware.js';
import type { MediaController } from './media.controller.js';
import { mediaController } from './media.container.js';

interface StudentMediaRouterDependencies {
  controller: Pick<MediaController, 'studentUrl' | 'studentDelivery'>;
  authenticationMiddleware: RequestHandler;
  studentRoleMiddleware: RequestHandler;
  permissionMiddleware: (...permissions: string[]) => RequestHandler;
}

export function createStudentMediaRouter(dependencies: StudentMediaRouterDependencies): Router {
  const router = Router();
  router.get(
    '/:id/student-url',
    dependencies.authenticationMiddleware,
    dependencies.studentRoleMiddleware,
    dependencies.permissionMiddleware('progress.self_read'),
    asyncHandler(dependencies.controller.studentUrl),
  );
  router.get('/student/:id', asyncHandler(dependencies.controller.studentDelivery));
  return router;
}

export const studentMediaRouter = createStudentMediaRouter({
  controller: mediaController,
  authenticationMiddleware: requireAuthentication,
  studentRoleMiddleware: requireRole(RoleCode.STUDENT),
  permissionMiddleware: requirePermission,
});
