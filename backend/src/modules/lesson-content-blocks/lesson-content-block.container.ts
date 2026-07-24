import { lessonManagementService } from '../lessons/lesson-management.container.js';
import { PrismaLessonContentBlockRepository } from './lesson-content-block.repository.js';
import { LessonContentBlockService } from './lesson-content-block.service.js';
import { MetadataOnlyLessonContentBlockDelivery } from './lesson-content-block.storage.js';

export const lessonContentBlockService = new LessonContentBlockService(
  new PrismaLessonContentBlockRepository(),
  lessonManagementService,
  new MetadataOnlyLessonContentBlockDelivery(),
);
