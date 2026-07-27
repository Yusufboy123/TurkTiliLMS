import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../progress';
import type {
  AdminProgressPage,
  ProgressReportingQuery,
  StudentProgressDetail,
  TeacherCourseProgressPage,
} from '../types/progress-reporting.types';

function queryParams(query: ProgressReportingQuery) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    ...(query.search ? { search: query.search } : {}),
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.enrollmentStatus ? { enrollmentStatus: query.enrollmentStatus } : {}),
    ...(query.progressState ? { progressState: query.progressState } : {}),
  };
}

export const progressReportingApi = {
  async getTeacherCourse(
    courseId: string,
    query: ProgressReportingQuery,
  ): Promise<TeacherCourseProgressPage> {
    const response = await apiClient.get<SuccessEnvelope<TeacherCourseProgressPage>>(
      `/courses/${courseId}/progress`,
      { params: queryParams(query) },
    );
    return response.data.data;
  },

  async getTeacherEnrollment(
    courseId: string,
    enrollmentId: string,
  ): Promise<StudentProgressDetail> {
    const response = await apiClient.get<SuccessEnvelope<StudentProgressDetail>>(
      `/courses/${courseId}/progress/enrollments/${enrollmentId}`,
    );
    return response.data.data;
  },

  async getAdmin(query: ProgressReportingQuery): Promise<AdminProgressPage> {
    const response = await apiClient.get<SuccessEnvelope<AdminProgressPage>>('/progress', {
      params: queryParams(query),
    });
    return response.data.data;
  },

  async getAdminEnrollment(enrollmentId: string): Promise<StudentProgressDetail> {
    const response = await apiClient.get<SuccessEnvelope<StudentProgressDetail>>(
      `/progress/enrollments/${enrollmentId}`,
    );
    return response.data.data;
  },
};
