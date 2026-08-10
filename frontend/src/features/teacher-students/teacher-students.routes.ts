export const teacherStudentPaths = {
  list: '/teacher/students',
  detail: (studentId: string) => `/teacher/students/${studentId}`,
  detailPattern: '/teacher/students/:studentId',
} as const;
