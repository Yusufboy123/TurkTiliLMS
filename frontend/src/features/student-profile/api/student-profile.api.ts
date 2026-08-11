import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type { StudentProfile, StudentProfileInput } from '../types/student-profile.types';

export const studentProfileApi = {
  async get(): Promise<StudentProfile | null> {
    const response = await apiClient.get<SuccessEnvelope<StudentProfile | null>>('/me/student-profile');
    return response.data.data;
  },
  async update(input: StudentProfileInput): Promise<StudentProfile> {
    const response = await apiClient.put<SuccessEnvelope<StudentProfile>>('/me/student-profile', input);
    return response.data.data;
  },
};
