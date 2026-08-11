export const adminUsersPaths = {
  list: '/admin/users',
  detail: (userId: string) => `/admin/users/${userId}`,
  detailPattern: '/admin/users/:userId',
  teachers: '/admin/users?role=TEACHER',
  students: '/admin/users?role=STUDENT',
} as const;
