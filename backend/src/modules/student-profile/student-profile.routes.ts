import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requireRole } from '../authorization/authorization.middleware.js';
import { studentProfileController } from './student-profile.container.js';
import type { StudentProfileController } from './student-profile.controller.js';

interface StudentProfileRouterDependencies {
  controller: StudentProfileController;
  authentication: RequestHandler;
  studentRole: RequestHandler;
}

export function createStudentProfileRouter(
  dependencies: StudentProfileRouterDependencies,
): Router {
  const router = Router();
  router.get(
    '/me/student-profile',
    dependencies.authentication,
    dependencies.studentRole,
    asyncHandler(dependencies.controller.get),
  );
  router.put(
    '/me/student-profile',
    dependencies.authentication,
    dependencies.studentRole,
    asyncHandler(dependencies.controller.update),
  );
  return router;
}

export const studentProfileRouter = createStudentProfileRouter({
  controller: studentProfileController,
  authentication: requireAuthentication,
  studentRole: requireRole(RoleCode.STUDENT),
});
