import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../authorization/authorization.middleware.js';
import { groupService } from './groups.container.js';
import { GroupController } from './groups.controller.js';

export function createGroupRouter(
  controller: GroupController,
  auth: RequestHandler,
  roles: RequestHandler,
  permission: (...permissions: string[]) => RequestHandler,
): Router {
  const router = Router();
  router.use(auth, roles);
  router.get('/', permission('groups.read'), asyncHandler(controller.list));
  router.post('/', permission('groups.create'), asyncHandler(controller.create));
  router.get('/:groupId', permission('groups.read'), asyncHandler(controller.getById));
  router.get(
    '/:groupId/students/search',
    permission('groups.read'),
    asyncHandler(controller.searchStudents),
  );
  router.post(
    '/:groupId/students',
    permission('groups.update_members'),
    asyncHandler(controller.addStudent),
  );
  router.delete(
    '/:groupId/students/:studentId',
    permission('groups.update_members'),
    asyncHandler(controller.removeStudent),
  );
  return router;
}

export const groupsRouter = createGroupRouter(
  new GroupController(groupService),
  requireAuthentication,
  requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  requirePermission,
);
