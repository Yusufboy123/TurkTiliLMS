export type VocabularyLearnerStatus = 'NEW' | 'KNOWN' | 'NEEDS_REVIEW';

export interface VocabularyLearningItem {
  id: string;
  lessonId: string;
  sourceId: string | null;
  sourceStatus: 'NEW' | 'REVIEW' | 'QUESTIONABLE';
  turkishWord: string;
  uzbekMeaning: string;
  exampleSentence: string | null;
  position: number;
  learnerStatus: VocabularyLearnerStatus;
  reviewCount: number;
}

export interface VocabularyTestQuestion {
  vocabularyId: string;
  prompt: string;
  direction: 'UZ_TO_TR_TYPED';
}

export interface VocabularyTestAttemptResult {
  id: string;
  lessonId: string;
  enrollmentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  status: 'IN_PROGRESS' | 'SUBMITTED';
}
