import { PrismaCourseRepository } from './course.repository.js';
import { CourseService } from './course.service.js';

export const courseService = new CourseService(new PrismaCourseRepository());
