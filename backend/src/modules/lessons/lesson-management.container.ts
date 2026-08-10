import { PrismaCourseRepository } from '../courses/course.repository.js';
import { PrismaStudentCourseContentAccess } from '../course-enrollments/course-content-access.js';
import { PrismaLessonManagementRepository } from './lesson-management.repository.js';
import {
  EnrollmentLessonAccessPolicy,
  LessonManagementService,
} from './lesson-management.service.js';

export const lessonManagementService = new LessonManagementService(
  new PrismaLessonManagementRepository(),
  new PrismaCourseRepository(),
  new EnrollmentLessonAccessPolicy(new PrismaStudentCourseContentAccess()),
);
