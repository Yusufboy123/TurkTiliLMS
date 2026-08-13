import { VocabularyLearningController } from './vocabulary-learning.controller.js';
import { VocabularyLearningRepository } from './vocabulary-learning.repository.js';
import { VocabularyLearningService } from './vocabulary-learning.service.js';
import { lessonMasteryAccess } from '../lesson-mastery/lesson-mastery.container.js';
const repository = new VocabularyLearningRepository();
export const vocabularyLearningController = new VocabularyLearningController(new VocabularyLearningService(repository, lessonMasteryAccess));
