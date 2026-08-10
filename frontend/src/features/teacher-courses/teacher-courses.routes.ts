export const teacherCoursePaths = {
  list: '/teacher/courses',
  new: '/teacher/courses/new',
  detail: (courseId: string) => `/teacher/courses/${courseId}`,
  detailPattern: '/teacher/courses/:courseId',
} as const;
