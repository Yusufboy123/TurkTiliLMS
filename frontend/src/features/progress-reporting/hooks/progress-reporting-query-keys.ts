import type { ProgressReportingQuery } from '../types/progress-reporting.types';

function stableQuery(query: ProgressReportingQuery) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    search: query.search ?? null,
    courseId: query.courseId ?? null,
    studentId: query.studentId ?? null,
    enrollmentStatus: query.enrollmentStatus ?? null,
    progressState: query.progressState ?? null,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };
}

export const progressReportingQueryKeys = {
  root: ['progress-reporting'] as const,
  teacherCourse: (courseId: string, query: ProgressReportingQuery) =>
    [...progressReportingQueryKeys.root, 'teacher', courseId, stableQuery(query)] as const,
  teacherEnrollment: (courseId: string, enrollmentId: string) =>
    [...progressReportingQueryKeys.root, 'teacher', courseId, 'enrollment', enrollmentId] as const,
  admin: (query: ProgressReportingQuery) =>
    [...progressReportingQueryKeys.root, 'admin', stableQuery(query)] as const,
  adminEnrollment: (enrollmentId: string) =>
    [...progressReportingQueryKeys.root, 'admin', 'enrollment', enrollmentId] as const,
};
