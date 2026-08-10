export const teacherCoursesQueryKeys = {
  root: ['teacher-courses'] as const,
  list: (query: object) => ['teacher-courses', 'list', query] as const,
  detail: (courseId: string) => ['teacher-courses', 'detail', courseId] as const,
  enrollments: (courseId: string) => ['teacher-courses', 'enrollments', courseId] as const,
};
