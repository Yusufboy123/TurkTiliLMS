export const teacherLessonsQueryKeys = {
  root: ['teacher-lessons'] as const,
  sections: (courseId: string) => ['teacher-lessons', 'sections', courseId] as const,
  list: (courseId: string, query: object) => ['teacher-lessons', 'list', courseId, query] as const,
  detail: (courseId: string, lessonId: string) => ['teacher-lessons', 'detail', courseId, lessonId] as const,
  blocks: (courseId: string, lessonId: string) => ['teacher-lessons', 'blocks', courseId, lessonId] as const,
};
