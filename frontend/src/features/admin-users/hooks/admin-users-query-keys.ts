export const adminUsersQueryKeys = {
  root: ['admin-users'] as const,
  list: (query: unknown) => [...adminUsersQueryKeys.root, 'list', query] as const,
  detail: (userId: string) => [...adminUsersQueryKeys.root, 'detail', userId] as const,
  student: (userId: string) => [...adminUsersQueryKeys.root, 'student', userId] as const,
  courses: (teacherId?: string) => [...adminUsersQueryKeys.root, 'courses', teacherId ?? 'all'] as const,
  eligibility: (courseId: string, enrollmentId: string) => [...adminUsersQueryKeys.root, 'eligibility', courseId, enrollmentId] as const,
  certificate: (courseId: string, enrollmentId: string) => [...adminUsersQueryKeys.root, 'certificate', courseId, enrollmentId] as const,
};
