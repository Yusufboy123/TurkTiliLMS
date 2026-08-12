export type LessonMasteryLockReason = 'PREVIOUS_LESSON' | 'PREVIOUS_MASTERY' | null;

export interface LessonMasteryDecision {
  allowed: boolean;
  lessonId: string;
  previousLessonId: string | null;
  previousLessonTitle: string | null;
  lockReason: LessonMasteryLockReason;
  requiredPercentage: number | null;
  previousPercentage: number | null;
}

export interface LessonMasteryAccess {
  canAccessCourseLesson(courseId: string, lessonId: string, studentId: string): Promise<boolean>;
  canAccessEnrollmentLesson(enrollmentId: string, lessonId: string, studentId: string): Promise<boolean>;
  canAccessMedia(mediaId: string, studentId: string): Promise<boolean>;
  evaluateCourseLesson(courseId: string, lessonId: string, studentId: string): Promise<LessonMasteryDecision>;
}
