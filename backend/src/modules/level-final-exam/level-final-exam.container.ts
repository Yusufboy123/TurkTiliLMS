import { PrismaLevelGate } from './level-gate.js';
import { LevelFinalExamController } from './level-final-exam.controller.js';
import { LevelFinalExamRepository } from './level-final-exam.repository.js';
import { LevelFinalExamService } from './level-final-exam.service.js';

const gate = new PrismaLevelGate();
const repository = new LevelFinalExamRepository();
export const levelFinalExamController = new LevelFinalExamController(new LevelFinalExamService(repository, gate));
