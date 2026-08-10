import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type {
  GroupPage,
  GroupQuery,
  GroupStudent,
  GroupLevel,
  TeacherGroup,
} from '../types/teacher-groups.types';

export const teacherGroupsApi = {
  async list(query: GroupQuery) {
    const response = await apiClient.get<SuccessEnvelope<GroupPage>>('/groups', { params: query });
    return response.data.data;
  },
  async get(groupId: string) {
    const response = await apiClient.get<SuccessEnvelope<TeacherGroup>>(`/groups/${groupId}`);
    return response.data.data;
  },
  async create(input: { name: string; level: GroupLevel; teacherId?: string }) {
    const response = await apiClient.post<SuccessEnvelope<TeacherGroup>>('/groups', input);
    return response.data.data;
  },
  async searchStudents(groupId: string, search: string) {
    const response = await apiClient.get<SuccessEnvelope<GroupStudent[]>>(
      `/groups/${groupId}/students/search`,
      { params: { search } },
    );
    return response.data.data;
  },
  async addStudent(groupId: string, studentId: string) {
    const response = await apiClient.post<SuccessEnvelope<TeacherGroup>>(
      `/groups/${groupId}/students`,
      { studentId },
    );
    return response.data.data;
  },
  async removeStudent(groupId: string, studentId: string) {
    await apiClient.delete(`/groups/${groupId}/students/${studentId}`);
  },
};
