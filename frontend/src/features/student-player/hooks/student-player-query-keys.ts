export const studentPlayerQueryKeys = {
  root: ['student-player'] as const,
  lesson: (courseSlug: string, lessonSlug: string) =>
    ['student-player', 'lesson', courseSlug, lessonSlug] as const,
  blocks: (courseSlug: string, lessonSlug: string) =>
    ['student-player', 'blocks', courseSlug, lessonSlug] as const,
};
