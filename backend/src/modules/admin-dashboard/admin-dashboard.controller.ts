import type { Request, Response } from 'express';
import {
  adminDashboardActor,
  adminDashboardAuditContext,
  adminDashboardPrincipal,
} from './admin-dashboard.request-context.js';
import { adminDashboardSummaryQuerySchema } from './admin-dashboard.schemas.js';
import type { AdminDashboardUseCases } from './admin-dashboard.service.js';

export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardUseCases) {}

  summary = async (request: Request, response: Response): Promise<void> => {
    adminDashboardSummaryQuerySchema.parse(request.query);
    const principal = adminDashboardPrincipal(request);
    const data = await this.dashboard.getSummary(
      adminDashboardActor(principal),
      adminDashboardAuditContext(request, principal),
    );
    response.status(200).json({
      success: true,
      message: 'Administrator boshqaruv paneli xulosasi olindi.',
      data,
    });
  };
}
