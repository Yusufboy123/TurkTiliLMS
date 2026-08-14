import type { CourseLevel, LevelFinalExamAttemptStatus, LessonQuizQuestionType, RoleCode } from '@prisma/client';

export interface LevelFinalExamActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface LevelFinalExamQuestion {
  id: string;
  type: LessonQuizQuestionType;
  prompt: string;
  points: number;
  position: number;
  options: Array<{ id: string; text: string; position: number }>;
}

export interface LevelFinalExamAttempt {
  id: string;
  examId: string;
  enrollmentId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  status: LevelFinalExamAttemptStatus;
}

export interface LevelFinalExamStatus {
  exam: { id: string; level: CourseLevel; title: string; passingPercentage: number; questionCount: number } | null;
  eligible: boolean;
  lessonsTotal: number;
  lessonsMastered: number;
  remainingRequirements: string[];
  latestResult: LevelFinalExamAttempt | null;
}
