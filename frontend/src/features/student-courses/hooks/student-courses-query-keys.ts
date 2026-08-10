export const studentCoursesQueryKeys = {
  all: ['student-courses'] as const,
  catalog: () => [...studentCoursesQueryKeys.all, 'catalog'] as const,
  enrollments: () => [...studentCoursesQueryKeys.all, 'enrollments'] as const,
};
