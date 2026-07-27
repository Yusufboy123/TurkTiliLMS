import { ProgressTrackingController } from './progress-tracking.controller.js';
import { PrismaProgressTrackingRepository } from './progress-tracking.repository.js';
import { ProgressTrackingService } from './progress-tracking.service.js';

export const progressTrackingRepository = new PrismaProgressTrackingRepository();
export const progressTrackingService = new ProgressTrackingService(progressTrackingRepository);
export const progressTrackingController = new ProgressTrackingController(progressTrackingService);
