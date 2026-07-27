import type { ProgressReportingQuery, ReportingSortField } from '../types/progress-reporting.types';

const enrollmentStatuses = new Set(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED']);
const progressStates = new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);
const sortFields = new Set([
  'lastActivityAt',
  'completedAt',
  'percentage',
  'enrolledAt',
  'studentName',
]);

function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) return fallback;
  return parsed;
}

export function reportingQueryFrom(searchParams: URLSearchParams): ProgressReportingQuery {
  const enrollmentStatus = searchParams.get('enrollmentStatus');
  const progressState = searchParams.get('progressState');
  const sortBy = searchParams.get('sortBy');
  const search = searchParams.get('search')?.trim();
  const courseId = searchParams.get('courseId')?.trim();
  const studentId = searchParams.get('studentId')?.trim();
  return {
    page: positiveInteger(searchParams.get('page'), 1),
    pageSize: positiveInteger(searchParams.get('pageSize'), 20, 100),
    sortBy: sortFields.has(sortBy ?? '') ? (sortBy as ReportingSortField) : 'lastActivityAt',
    sortDirection: searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc',
    ...(search ? { search } : {}),
    ...(courseId ? { courseId } : {}),
    ...(studentId ? { studentId } : {}),
    ...(enrollmentStatus && enrollmentStatuses.has(enrollmentStatus)
      ? { enrollmentStatus: enrollmentStatus as ProgressReportingQuery['enrollmentStatus'] }
      : {}),
    ...(progressState && progressStates.has(progressState)
      ? { progressState: progressState as ProgressReportingQuery['progressState'] }
      : {}),
  };
}

export function reportingSearchParams(query: ProgressReportingQuery): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.search) params.set('search', query.search);
  if (query.courseId) params.set('courseId', query.courseId);
  if (query.studentId) params.set('studentId', query.studentId);
  if (query.enrollmentStatus) params.set('enrollmentStatus', query.enrollmentStatus);
  if (query.progressState) params.set('progressState', query.progressState);
  return params;
}
