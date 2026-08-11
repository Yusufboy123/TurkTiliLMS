import { LessonLearningRepository } from './lesson-learning.repository.js';
import { LessonLearningService } from './lesson-learning.service.js';
import { LessonLearningController } from './lesson-learning.controller.js';

export const lessonLearningRepository = new LessonLearningRepository();
export const lessonLearningService = new LessonLearningService(lessonLearningRepository);
export const lessonLearningController = new LessonLearningController(lessonLearningService);
