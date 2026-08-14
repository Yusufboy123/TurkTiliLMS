import { CourseEnrollmentController } from './course-enrollment.controller.js';
import { PrismaCourseEnrollmentRepository } from './course-enrollment.repository.js';
import { CourseEnrollmentService } from './course-enrollment.service.js';
import { PrismaLevelGate } from '../level-final-exam/level-gate.js';

export const courseEnrollmentRepository = new PrismaCourseEnrollmentRepository();
export const courseEnrollmentService = new CourseEnrollmentService(courseEnrollmentRepository, new PrismaLevelGate());
export const courseEnrollmentController = new CourseEnrollmentController(courseEnrollmentService);
