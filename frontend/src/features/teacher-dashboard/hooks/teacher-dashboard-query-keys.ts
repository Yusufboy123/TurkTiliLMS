import type { AssignedTeacherCourseQuery } from '../types/teacher-dashboard.types';

function stableCourseQuery(query: AssignedTeacherCourseQuery) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    deleted: query.deleted,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };
}

export const teacherDashboardQueryKeys = {
  root: ['teacher-dashboard'] as const,
  courses: (query: AssignedTeacherCourseQuery) =>
    [...teacherDashboardQueryKeys.root, 'assigned-courses', stableCourseQuery(query)] as const,
};
