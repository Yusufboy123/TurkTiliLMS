import type { SuccessEnvelope } from '../../auth/types/auth.types';
import { apiClient } from '../../../lib/api-client';
import type { FinalExamStart, FinalExamStatus, FinalExamResult, LevelGateState } from '../types/level-final-exam.types';

export const levelFinalExamApi = {
  async gates(): Promise<LevelGateState[]> {
    const response = await apiClient.get<SuccessEnvelope<LevelGateState[]>>('/me/level-gates');
    return response.data.data;
  },
  async status(enrollmentId: string): Promise<FinalExamStatus> {
    const response = await apiClient.get<SuccessEnvelope<FinalExamStatus>>(`/enrollments/${enrollmentId}/final-exam`);
    return response.data.data;
  },
  async start(enrollmentId: string): Promise<FinalExamStart> {
    const response = await apiClient.post<SuccessEnvelope<FinalExamStart>>(`/enrollments/${enrollmentId}/final-exam/attempts`, {});
    return response.data.data;
  },
  async submit(enrollmentId: string, attemptId: string, answers: Array<{ questionId: string; submittedAnswer: string }>): Promise<FinalExamResult> {
    const response = await apiClient.post<SuccessEnvelope<FinalExamResult>>(`/enrollments/${enrollmentId}/final-exam/attempts/${attemptId}/submit`, { answers });
    return response.data.data;
  },
};
