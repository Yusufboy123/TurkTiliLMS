import { queryOptions, useQuery } from '@tanstack/react-query';
import { progressApi } from '../api/progress.api';
import type { CompletedCourseQuery } from '../types/progress.types';
import { progressQueryKeys } from './progress-query-keys';

export function progressSummaryQueryOptions(activeLimit = 5) {
  return queryOptions({
    queryKey: progressQueryKeys.summary(activeLimit),
    queryFn: () => progressApi.getSummary(activeLimit),
  });
}

export function completedCoursesQueryOptions(query: CompletedCourseQuery) {
  return queryOptions({
    queryKey: progressQueryKeys.completed(query),
    queryFn: () => progressApi.getCompletedCourses(query),
  });
}

export function enrollmentProgressQueryOptions(enrollmentId: string) {
  return queryOptions({
    queryKey: progressQueryKeys.enrollment(enrollmentId),
    queryFn: () => progressApi.getEnrollmentProgress(enrollmentId),
    enabled: Boolean(enrollmentId),
  });
}

export function resumeTargetQueryOptions(enrollmentId: string) {
  return queryOptions({
    queryKey: progressQueryKeys.resume(enrollmentId),
    queryFn: () => progressApi.getResumeTarget(enrollmentId),
    enabled: Boolean(enrollmentId),
  });
}

export function useProgressSummary(activeLimit = 5) {
  return useQuery(progressSummaryQueryOptions(activeLimit));
}

export function useCompletedCourses(query: CompletedCourseQuery) {
  return useQuery(completedCoursesQueryOptions(query));
}

export function useEnrollmentProgress(enrollmentId: string) {
  return useQuery(enrollmentProgressQueryOptions(enrollmentId));
}

export function useResumeTarget(enrollmentId: string) {
  return useQuery(resumeTargetQueryOptions(enrollmentId));
}
