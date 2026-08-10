import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type {
  CourseEnrollmentPage,
  CreateTeacherCourseInput,
  TeacherCourse,
  TeacherCourseListQuery,
  TeacherCoursePage,
  TeacherCourseStatus,
  UpdateTeacherCourseInput,
} from '../types/teacher-courses.types';

export const teacherCoursesApi = {
  async list(query: TeacherCourseListQuery): Promise<TeacherCoursePage> {
    const response = await apiClient.get<SuccessEnvelope<TeacherCoursePage>>('/courses', {
      params: query,
    });
    return response.data.data;
  },
  async get(courseId: string): Promise<TeacherCourse> {
    const response = await apiClient.get<SuccessEnvelope<TeacherCourse>>(`/courses/${courseId}`);
    return response.data.data;
  },
  async create(input: CreateTeacherCourseInput): Promise<TeacherCourse> {
    const response = await apiClient.post<SuccessEnvelope<TeacherCourse>>('/courses', input);
    return response.data.data;
  },
  async update(courseId: string, input: UpdateTeacherCourseInput): Promise<TeacherCourse> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherCourse>>(
      `/courses/${courseId}`,
      input,
    );
    return response.data.data;
  },
  async updateStatus(courseId: string, status: TeacherCourseStatus): Promise<TeacherCourse> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherCourse>>(
      `/courses/${courseId}/status`,
      { status },
    );
    return response.data.data;
  },
  async listEnrollments(courseId: string): Promise<CourseEnrollmentPage> {
    const response = await apiClient.get<SuccessEnvelope<CourseEnrollmentPage>>(
      `/courses/${courseId}/enrollments`,
      { params: { page: 1, pageSize: 1 } },
    );
    return response.data.data;
  },
};
