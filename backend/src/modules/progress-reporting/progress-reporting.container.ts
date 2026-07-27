import { ProgressReportingController } from './progress-reporting.controller.js';
import { PrismaProgressReportingRepository } from './progress-reporting.repository.js';
import { ProgressReportingService } from './progress-reporting.service.js';

export const progressReportingRepository = new PrismaProgressReportingRepository();
export const progressReportingService = new ProgressReportingService(progressReportingRepository);
export const progressReportingController = new ProgressReportingController(
  progressReportingService,
);
