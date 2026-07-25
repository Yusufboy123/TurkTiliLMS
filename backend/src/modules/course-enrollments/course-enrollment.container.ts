import { CourseEnrollmentController } from './course-enrollment.controller.js';
import { PrismaCourseEnrollmentRepository } from './course-enrollment.repository.js';
import { CourseEnrollmentService } from './course-enrollment.service.js';

export const courseEnrollmentRepository = new PrismaCourseEnrollmentRepository();
export const courseEnrollmentService = new CourseEnrollmentService(courseEnrollmentRepository);
export const courseEnrollmentController = new CourseEnrollmentController(courseEnrollmentService);
