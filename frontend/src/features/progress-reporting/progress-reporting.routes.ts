export const progressReportingPaths = {
  teacherCoursePattern: '/teacher/courses/:courseId/progress',
  teacherEnrollmentPattern: '/teacher/courses/:courseId/students/:enrollmentId/progress',
  teacherCourse: (courseId: string) => `/teacher/courses/${courseId}/progress`,
  teacherEnrollment: (courseId: string, enrollmentId: string) =>
    `/teacher/courses/${courseId}/students/${enrollmentId}/progress`,
  admin: '/admin/progress',
  adminEnrollmentPattern: '/admin/progress/enrollments/:enrollmentId',
  adminEnrollment: (enrollmentId: string) => `/admin/progress/enrollments/${enrollmentId}`,
} as const;
