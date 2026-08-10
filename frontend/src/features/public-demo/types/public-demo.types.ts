export type PracticeQuestionKind =
  | 'letter-choice'
  | 'distinction'
  | 'special-choice'
  | 'missing-letter'
  | 'matching'
  | 'word-recognition'
  | 'concept';

export interface QuizQuestion {
  id: string;
  kind: PracticeQuestionKind;
  prompt: string;
  options: readonly string[];
  answer: string;
  explanation: string;
}

export interface AlphabetLetter {
  uppercase: string;
  lowercase: string;
  special?: boolean;
}

export interface LearningLevel {
  level: string;
  label: string;
  description: string;
}

export interface PracticeState {
  index: number;
  points: number;
  streak: number;
  answered: boolean;
  selectedAnswer: string | null;
}

export interface AssessmentResult {
  total: number;
  correct: number;
  incorrect: number;
  percentage: number;
}
