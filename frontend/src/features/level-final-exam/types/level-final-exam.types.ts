export type FinalExamQuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD';

export interface FinalExamQuestion {
  id: string;
  type: FinalExamQuestionType;
  prompt: string;
  points: number;
  position: number;
  options: Array<{ id: string; text: string; position: number }>;
}

export interface FinalExamResult {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  submittedAt: string | null;
}

export interface FinalExamStatus {
  exam: { id: string; level: string; title: string; passingPercentage: number; questionCount: number } | null;
  eligible: boolean;
  lessonsTotal: number;
  lessonsMastered: number;
  remainingRequirements: string[];
  latestResult: FinalExamResult | null;
}

export interface FinalExamStart {
  attempt: FinalExamResult & { startedAt: string };
  questions: FinalExamQuestion[];
}

export interface LevelGateState {
  targetLevel: string;
  previousLevel: string | null;
  allowed: boolean;
  reason: string;
  remainingRequirements: string[];
}
