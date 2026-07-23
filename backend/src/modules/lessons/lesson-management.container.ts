import { PrismaCourseRepository } from '../courses/course.repository.js';
import { PrismaLessonManagementRepository } from './lesson-management.repository.js';
import {
  EnrollmentPendingLessonAccessPolicy,
  LessonManagementService,
} from './lesson-management.service.js';

export const lessonManagementService = new LessonManagementService(
  new PrismaLessonManagementRepository(),
  new PrismaCourseRepository(),
  new EnrollmentPendingLessonAccessPolicy(),
);
