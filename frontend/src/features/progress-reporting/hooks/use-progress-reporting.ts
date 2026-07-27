import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { progressReportingApi } from '../api/progress-reporting.api';
import type { ProgressReportingQuery } from '../types/progress-reporting.types';
import { progressReportingQueryKeys } from './progress-reporting-query-keys';

export function useTeacherCourseReporting(courseId: string, query: ProgressReportingQuery) {
  return useQuery({
    queryKey: progressReportingQueryKeys.teacherCourse(courseId, query),
    queryFn: () => progressReportingApi.getTeacherCourse(courseId, query),
    enabled: Boolean(courseId),
    placeholderData: keepPreviousData,
  });
}

export function useTeacherEnrollmentReporting(courseId: string, enrollmentId: string) {
  return useQuery({
    queryKey: progressReportingQueryKeys.teacherEnrollment(courseId, enrollmentId),
    queryFn: () => progressReportingApi.getTeacherEnrollment(courseId, enrollmentId),
    enabled: Boolean(courseId && enrollmentId),
  });
}

export function useAdminReporting(query: ProgressReportingQuery) {
  return useQuery({
    queryKey: progressReportingQueryKeys.admin(query),
    queryFn: () => progressReportingApi.getAdmin(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminEnrollmentReporting(enrollmentId: string) {
  return useQuery({
    queryKey: progressReportingQueryKeys.adminEnrollment(enrollmentId),
    queryFn: () => progressReportingApi.getAdminEnrollment(enrollmentId),
    enabled: Boolean(enrollmentId),
  });
}
