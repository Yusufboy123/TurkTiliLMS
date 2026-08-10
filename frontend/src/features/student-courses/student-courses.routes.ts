export const studentCoursesPaths = {
  list: '/app/courses',
  course: (courseId: string) => `/app/courses/${courseId}`,
  coursePattern: '/app/courses/:courseId',
} as const;
