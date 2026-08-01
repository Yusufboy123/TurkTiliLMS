import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../progress';
import type {
  AssignedTeacherCoursePage,
  AssignedTeacherCourseQuery,
} from '../types/teacher-dashboard.types';

export const teacherDashboardApi = {
  async getAssignedCourses(query: AssignedTeacherCourseQuery): Promise<AssignedTeacherCoursePage> {
    const response = await apiClient.get<SuccessEnvelope<AssignedTeacherCoursePage>>('/courses', {
      params: query,
    });
    return response.data.data;
  },
};
