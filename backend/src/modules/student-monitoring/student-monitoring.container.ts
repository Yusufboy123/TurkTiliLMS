import { PrismaStudentMonitoringRepository } from './student-monitoring.repository.js';
import { StudentMonitoringService } from './student-monitoring.service.js';

export const studentMonitoringService = new StudentMonitoringService(
  new PrismaStudentMonitoringRepository(),
);
