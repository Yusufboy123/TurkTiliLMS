import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type { TeacherStudentDetail, TeacherStudentPage } from '../types/teacher-students.types';

export const teacherStudentsApi = {
  async list(search?: string): Promise<TeacherStudentPage> {
    const response = await apiClient.get<SuccessEnvelope<TeacherStudentPage>>('/students', {
      params: { page: 1, pageSize: 50, ...(search ? { search } : {}) },
    });
    return response.data.data;
  },
  async getById(studentId: string): Promise<TeacherStudentDetail> {
    const response = await apiClient.get<SuccessEnvelope<TeacherStudentDetail>>(
      `/students/${studentId}`,
    );
    return response.data.data;
  },
};
