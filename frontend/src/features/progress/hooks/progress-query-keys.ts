import type { CompletedCourseQuery } from '../types/progress.types';

export const progressQueryKeys = {
  all: ['progress'] as const,
  summary: (activeLimit: number) => [...progressQueryKeys.all, 'summary', activeLimit] as const,
  completedRoot: () => [...progressQueryKeys.all, 'completed'] as const,
  completed: (query: CompletedCourseQuery) =>
    [...progressQueryKeys.completedRoot(), query] as const,
  enrollmentRoot: (enrollmentId: string) =>
    [...progressQueryKeys.all, 'enrollment', enrollmentId] as const,
  enrollment: (enrollmentId: string) =>
    [...progressQueryKeys.enrollmentRoot(enrollmentId), 'detail'] as const,
  resume: (enrollmentId: string) =>
    [...progressQueryKeys.enrollmentRoot(enrollmentId), 'resume'] as const,
};
