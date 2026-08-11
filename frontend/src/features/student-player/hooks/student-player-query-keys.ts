export const studentPlayerQueryKeys = {
  root: ['student-player'] as const,
  lesson: (courseSlug: string, lessonSlug: string) =>
    ['student-player', 'lesson', courseSlug, lessonSlug] as const,
  blocks: (courseSlug: string, lessonSlug: string) =>
    ['student-player', 'blocks', courseSlug, lessonSlug] as const,
  vocabulary: (enrollmentId: string, lessonId: string) => ['student-player', 'vocabulary', enrollmentId, lessonId] as const,
  quiz: (enrollmentId: string, lessonId: string) => ['student-player', 'quiz', enrollmentId, lessonId] as const,
  quizResult: (enrollmentId: string, lessonId: string) => ['student-player', 'quiz-result', enrollmentId, lessonId] as const,
};
