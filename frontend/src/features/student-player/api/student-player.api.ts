import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type { StudentLessonBlock, StudentLessonContent, StudentPracticeResult, StudentQuiz, StudentQuizAnswerInput, StudentQuizAttempt, StudentVocabulary, StudentVocabularyTestAttempt, VocabularyTestStart } from '../types/student-player.types';

export const studentPlayerApi = {
  async getMediaUrl(mediaId: string): Promise<{ url: string; expiresAt: string }> {
    const response = await apiClient.get<SuccessEnvelope<{ url: string; expiresAt: string }>>(`/media/${mediaId}/student-url`);
    return response.data.data;
  },
  async getLesson(courseSlug: string, lessonSlug: string): Promise<StudentLessonContent> {
    const response = await apiClient.get<SuccessEnvelope<StudentLessonContent>>(
      `/catalog/courses/${courseSlug}/lessons/${lessonSlug}`,
    );
    return response.data.data;
  },
  async getBlocks(courseSlug: string, lessonSlug: string): Promise<StudentLessonBlock[]> {
    const response = await apiClient.get<SuccessEnvelope<StudentLessonBlock[]>>(
      `/catalog/courses/${courseSlug}/lessons/${lessonSlug}/blocks`,
    );
    return response.data.data;
  },
  async getVocabulary(enrollmentId: string, lessonId: string): Promise<StudentVocabulary[]> {
    const response = await apiClient.get<SuccessEnvelope<StudentVocabulary[]>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/vocabulary`);
    return response.data.data;
  },
  async getVocabularyLearning(enrollmentId: string, lessonId: string): Promise<StudentVocabulary[]> {
    const response = await apiClient.get<SuccessEnvelope<StudentVocabulary[]>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/vocabulary/learning`);
    return response.data.data;
  },
  async updateVocabularyStatus(enrollmentId: string, lessonId: string, vocabularyId: string, status: 'KNOWN' | 'NEEDS_REVIEW'): Promise<void> {
    await apiClient.post(`/enrollments/${enrollmentId}/lessons/${lessonId}/vocabulary/${vocabularyId}/status`, { status });
  },
  async startVocabularyTest(enrollmentId: string, lessonId: string): Promise<VocabularyTestStart> {
    const response = await apiClient.post<SuccessEnvelope<VocabularyTestStart>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/vocabulary/test/attempts`, {});
    return response.data.data;
  },
  async submitVocabularyTest(enrollmentId: string, lessonId: string, attemptId: string, answers: Array<{ vocabularyId: string; submittedAnswer: string }>): Promise<StudentVocabularyTestAttempt> {
    const response = await apiClient.post<SuccessEnvelope<StudentVocabularyTestAttempt>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/vocabulary/test/attempts/${attemptId}/submit`, { answers });
    return response.data.data;
  },
  async getLatestVocabularyResult(enrollmentId: string, lessonId: string): Promise<StudentVocabularyTestAttempt | null> {
    const response = await apiClient.get<SuccessEnvelope<StudentVocabularyTestAttempt | null>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/vocabulary/test/results/latest`);
    return response.data.data;
  },
  async getQuiz(enrollmentId: string, lessonId: string): Promise<StudentQuiz> {
    const response = await apiClient.get<SuccessEnvelope<StudentQuiz>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/quiz`);
    return response.data.data;
  },
  async startQuiz(enrollmentId: string, lessonId: string): Promise<StudentQuizAttempt> {
    const response = await apiClient.post<SuccessEnvelope<StudentQuizAttempt>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/quiz/attempts`, {});
    return response.data.data;
  },
  async submitQuiz(enrollmentId: string, lessonId: string, attemptId: string, answers: StudentQuizAnswerInput[]): Promise<StudentQuizAttempt> {
    const response = await apiClient.post<SuccessEnvelope<StudentQuizAttempt>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/quiz/attempts/${attemptId}/submit`, { answers });
    return response.data.data;
  },
  async getLatestQuizResult(enrollmentId: string, lessonId: string): Promise<StudentQuizAttempt | null> {
    const response = await apiClient.get<SuccessEnvelope<StudentQuizAttempt | null>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/quiz/results/latest`);
    return response.data.data;
  },
  async submitPractice(enrollmentId: string, lessonId: string, practiceId: string, answer: string): Promise<StudentPracticeResult> {
    const response = await apiClient.post<SuccessEnvelope<StudentPracticeResult>>(`/enrollments/${enrollmentId}/lessons/${lessonId}/practice/${encodeURIComponent(practiceId)}/answer`, { answer });
    return response.data.data;
  },
};
