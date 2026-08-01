import type { ProgressReportingQuery } from '../progress-reporting';
import type { AssignedTeacherCourseQuery } from './types/teacher-dashboard.types';

export const TEACHER_DASHBOARD_PAGE_SIZE = 6;

export const TEACHER_DASHBOARD_REPORT_QUERY: ProgressReportingQuery = {
  page: 1,
  pageSize: 1,
  sortBy: 'lastActivityAt',
  sortDirection: 'desc',
};

export function teacherDashboardCourseQuery(page: number): AssignedTeacherCourseQuery {
  return {
    page,
    pageSize: TEACHER_DASHBOARD_PAGE_SIZE,
    deleted: 'exclude',
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  };
}

export function normalizeTeacherDashboardPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(Math.max(page, 1), totalPages);
}
