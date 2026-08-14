import { PrismaLessonMasteryAccess } from './lesson-mastery.service.js';
import { PrismaLevelGate } from '../level-final-exam/level-gate.js';

export const lessonMasteryAccess = new PrismaLessonMasteryAccess(undefined, new PrismaLevelGate());
