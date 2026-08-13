import type { LessonContentBlockType } from '../../progress/types/progress.types';

export interface StudentMediaReference {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  category: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';
  sizeBytes: string;
  downloadUrl: string | null;
  previewUrl: string | null;
  deletedAt: string | null;
}

export interface StudentLessonContent {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  lessonType: 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'QUIZ' | 'ASSIGNMENT' | 'LIVE';
  durationMinutes: number | null;
  isPreview: boolean;
  publishedAt: string;
  section: { id: string; title: string };
}

export interface StudentLessonBlock {
  id: string;
  mediaFileId: string | null;
  media: StudentMediaReference | null;
  blockType: LessonContentBlockType;
  title: string | null;
  description: string | null;
  position: number;
  isRequired: boolean;
  textContent: string | null;
  sourceUrl: string | null;
  externalProvider: string | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  interactivePractice?: InteractivePracticeItem[] | undefined;
}

export type InteractivePracticeItemType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD' | 'CLASSIFY';

export interface InteractivePracticeItem {
  id: string;
  type: InteractivePracticeItemType;
  prompt: string;
  options?: string[];
  explanation: string;
  stage: number;
}

export interface StudentPracticeResult {
  practiceId: string;
  correct: boolean;
  explanation: string;
  correctAnswer?: string;
}

export interface StudentVocabulary {
  id: string;
  lessonId: string;
  turkishWord: string;
  uzbekMeaning: string;
  exampleSentence: string | null;
  position: number;
  sourceId?: string | null;
  sourceStatus?: 'NEW' | 'REVIEW' | 'QUESTIONABLE';
  learnerStatus?: 'NEW' | 'KNOWN' | 'NEEDS_REVIEW';
  reviewCount?: number;
}

export interface VocabularyTestQuestion { vocabularyId: string; prompt: string; direction: 'UZ_TO_TR_TYPED'; }
export interface VocabularyTestStart { attempt: StudentVocabularyTestAttempt; questions: VocabularyTestQuestion[]; }
export interface StudentVocabularyTestAttempt { id: string; lessonId: string; enrollmentId: string; startedAt: string; submittedAt: string | null; score: number; maxScore: number; percentage: number; correctCount: number; incorrectCount: number; status: 'IN_PROGRESS' | 'SUBMITTED'; }

export type StudentQuizQuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD';

export interface StudentQuizQuestion {
  id: string;
  type: StudentQuizQuestionType;
  prompt: string;
  points: number;
  position: number;
  options: Array<{ id: string; text: string; position: number }>;
}

export interface StudentQuiz {
  lessonId: string;
  questions: StudentQuizQuestion[];
}

export interface StudentQuizAttempt {
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

export interface StudentQuizAnswerInput {
  questionId: string;
  submittedAnswer: string;
}
