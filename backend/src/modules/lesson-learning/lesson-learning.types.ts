import type { LessonQuizAttemptStatus, LessonQuizQuestionType, RoleCode } from '@prisma/client';

export interface LearningActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface VocabularyRecord {
  id: string;
  lessonId: string;
  turkishWord: string;
  uzbekMeaning: string;
  exampleSentence: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizOptionRecord {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface QuizQuestionRecord {
  id: string;
  lessonId: string;
  type: LessonQuizQuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  position: number;
  options: QuizOptionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentQuizOption {
  id: string;
  text: string;
  position: number;
}

export interface StudentQuizQuestion {
  id: string;
  type: LessonQuizQuestionType;
  prompt: string;
  points: number;
  position: number;
  options: StudentQuizOption[];
}

export interface StudentQuiz {
  lessonId: string;
  questions: StudentQuizQuestion[];
}

export interface QuizAttemptSummary {
  id: string;
  lessonId: string;
  enrollmentId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  status: LessonQuizAttemptStatus;
}

export interface TeacherQuizResult {
  student: { id: string; name: string; email: string };
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  submittedAt: Date | null;
}

export interface LearningAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}
