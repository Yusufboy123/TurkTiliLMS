import { StudentProfileController } from './student-profile.controller.js';
import { PrismaStudentProfileRepository } from './student-profile.repository.js';
import { StudentProfileService } from './student-profile.service.js';

export const studentProfileRepository = new PrismaStudentProfileRepository();
export const studentProfileService = new StudentProfileService(studentProfileRepository);
export const studentProfileController = new StudentProfileController(studentProfileService);
