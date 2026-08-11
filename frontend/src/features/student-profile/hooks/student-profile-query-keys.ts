export const studentProfileQueryKeys = {
  root: ['student-profile'] as const,
  current: () => ['student-profile', 'current'] as const,
};
