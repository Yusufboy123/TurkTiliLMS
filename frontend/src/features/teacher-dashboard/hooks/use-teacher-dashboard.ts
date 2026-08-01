import { useQuery } from '@tanstack/react-query';
import { teacherDashboardApi } from '../api/teacher-dashboard.api';
import type { AssignedTeacherCourseQuery } from '../types/teacher-dashboard.types';
import { teacherDashboardQueryKeys } from './teacher-dashboard-query-keys';

export function useAssignedTeacherCourses(query: AssignedTeacherCourseQuery) {
  return useQuery({
    queryKey: teacherDashboardQueryKeys.courses(query),
    queryFn: () => teacherDashboardApi.getAssignedCourses(query),
  });
}
