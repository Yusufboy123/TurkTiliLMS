import { LessonLearningRepository } from './lesson-learning.repository.js';
import { LessonLearningService } from './lesson-learning.service.js';
import { LessonLearningController } from './lesson-learning.controller.js';
import { lessonMasteryAccess } from '../lesson-mastery/lesson-mastery.container.js';

export const lessonLearningRepository = new LessonLearningRepository();
export const lessonLearningService = new LessonLearningService(lessonLearningRepository, lessonMasteryAccess);
export const lessonLearningController = new LessonLearningController(lessonLearningService);
