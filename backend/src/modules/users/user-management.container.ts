import { PrismaUserManagementRepository } from './user-management.repository.js';
import { UserManagementService } from './user-management.service.js';

export const userManagementService = new UserManagementService(
  new PrismaUserManagementRepository(),
);
