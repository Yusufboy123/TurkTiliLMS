import { AdminDashboardController } from './admin-dashboard.controller.js';
import { PrismaAdminDashboardRepository } from './admin-dashboard.repository.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

export const adminDashboardRepository = new PrismaAdminDashboardRepository();
export const adminDashboardService = new AdminDashboardService(adminDashboardRepository);
export const adminDashboardController = new AdminDashboardController(adminDashboardService);
