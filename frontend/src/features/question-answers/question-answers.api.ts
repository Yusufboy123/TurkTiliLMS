import { apiClient } from '../../lib/api-client';
import type { SuccessEnvelope } from '../progress';
import type { QuestionPage, QuestionThread } from './question-answers.types';
export const questionAnswersApi = {
  async studentList(): Promise<QuestionPage> { const response = await apiClient.get<SuccessEnvelope<QuestionPage>>('/me/questions', { params: { page: 1, pageSize: 50 } }); return response.data.data; },
  async studentDetail(id: string): Promise<QuestionThread> { const response = await apiClient.get<SuccessEnvelope<QuestionThread>>(`/me/questions/${id}`); return response.data.data; },
  async create(input: { courseId: string; lessonId?: string; subject?: string; body: string }): Promise<QuestionThread> { const response = await apiClient.post<SuccessEnvelope<QuestionThread>>('/me/questions', input); return response.data.data; },
  async studentMessage(id: string, body: string): Promise<QuestionThread> { const response = await apiClient.post<SuccessEnvelope<QuestionThread>>(`/me/questions/${id}/messages`, { body }); return response.data.data; },
  async teacherList(status?: string): Promise<QuestionPage> { const response = await apiClient.get<SuccessEnvelope<QuestionPage>>('/teacher/questions', { params: { page: 1, pageSize: 50, ...(status ? { status } : {}) } }); return response.data.data; },
  async teacherDetail(id: string): Promise<QuestionThread> { const response = await apiClient.get<SuccessEnvelope<QuestionThread>>(`/teacher/questions/${id}`); return response.data.data; },
  async teacherMessage(id: string, body: string): Promise<QuestionThread> { const response = await apiClient.post<SuccessEnvelope<QuestionThread>>(`/teacher/questions/${id}/messages`, { body }); return response.data.data; },
  async setStatus(id: string, status: 'OPEN' | 'CLOSED'): Promise<QuestionThread> { const response = await apiClient.patch<SuccessEnvelope<QuestionThread>>(`/teacher/questions/${id}/status`, { status }); return response.data.data; },
};
