export const teacherLessonPaths = {
  list: (courseId: string) => `/teacher/courses/${courseId}/lessons`,
  listPattern: '/teacher/courses/:courseId/lessons',
  new: (courseId: string) => `/teacher/courses/${courseId}/lessons/new`,
  newPattern: '/teacher/courses/:courseId/lessons/new',
  detail: (courseId: string, lessonId: string) => `/teacher/courses/${courseId}/lessons/${lessonId}`,
  detailPattern: '/teacher/courses/:courseId/lessons/:lessonId',
} as const;
