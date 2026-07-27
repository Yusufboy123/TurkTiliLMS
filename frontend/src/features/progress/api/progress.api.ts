import axios from 'axios';
import { apiClient } from '../../../lib/api-client';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type {
  ActivityMutationResult,
  ApiErrorEnvelope,
  CompletedCoursePage,
  CompletedCourseQuery,
  CompletionMutationInput,
  CourseProgress,
  LastVisitedMutationInput,
  ProgressMutationResult,
  ResumeLearning,
  StudentProgressSummary,
  SuccessEnvelope,
} from '../types/progress.types';

function unwrap<T>(envelope: SuccessEnvelope<T>): T {
  return envelope.data;
}

function mutationHeaders(idempotencyKey: string) {
  return { 'Idempotency-Key': idempotencyKey };
}

export const progressApi = {
  async getSummary(activeLimit = 5): Promise<StudentProgressSummary> {
    const response = await apiClient.get<SuccessEnvelope<StudentProgressSummary>>('/me/progress', {
      params: { activeLimit },
    });
    return unwrap(response.data);
  },

  async getCompletedCourses(query: CompletedCourseQuery): Promise<CompletedCoursePage> {
    const response = await apiClient.get<SuccessEnvelope<CompletedCoursePage>>(
      '/me/progress/completed-courses',
      { params: query },
    );
    return unwrap(response.data);
  },

  async getEnrollmentProgress(enrollmentId: string): Promise<CourseProgress> {
    const response = await apiClient.get<SuccessEnvelope<CourseProgress>>(
      `/me/enrollments/${enrollmentId}/progress`,
    );
    return unwrap(response.data);
  },

  async getResumeTarget(enrollmentId: string): Promise<ResumeLearning | null> {
    const response = await apiClient.get<SuccessEnvelope<ResumeLearning | null>>(
      `/me/enrollments/${enrollmentId}/progress/resume`,
    );
    return unwrap(response.data);
  },

  async completeBlock(
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    idempotencyKey: string,
  ): Promise<ProgressMutationResult> {
    const response = await apiClient.post<SuccessEnvelope<ProgressMutationResult>>(
      `/me/enrollments/${enrollmentId}/progress/blocks/${blockId}/complete`,
      input,
      { headers: mutationHeaders(idempotencyKey) },
    );
    return unwrap(response.data);
  },

  async reopenBlock(
    enrollmentId: string,
    blockId: string,
    input: CompletionMutationInput,
    idempotencyKey: string,
  ): Promise<ProgressMutationResult> {
    const response = await apiClient.post<SuccessEnvelope<ProgressMutationResult>>(
      `/me/enrollments/${enrollmentId}/progress/blocks/${blockId}/reopen`,
      input,
      { headers: mutationHeaders(idempotencyKey) },
    );
    return unwrap(response.data);
  },

  async completeLesson(
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    idempotencyKey: string,
  ): Promise<ProgressMutationResult> {
    const response = await apiClient.post<SuccessEnvelope<ProgressMutationResult>>(
      `/me/enrollments/${enrollmentId}/progress/lessons/${lessonId}/complete`,
      input,
      { headers: mutationHeaders(idempotencyKey) },
    );
    return unwrap(response.data);
  },

  async reopenLesson(
    enrollmentId: string,
    lessonId: string,
    input: CompletionMutationInput,
    idempotencyKey: string,
  ): Promise<ProgressMutationResult> {
    const response = await apiClient.post<SuccessEnvelope<ProgressMutationResult>>(
      `/me/enrollments/${enrollmentId}/progress/lessons/${lessonId}/reopen`,
      input,
      { headers: mutationHeaders(idempotencyKey) },
    );
    return unwrap(response.data);
  },

  async recordLastVisitedLesson(
    enrollmentId: string,
    input: LastVisitedMutationInput,
    idempotencyKey: string,
  ): Promise<ActivityMutationResult> {
    const response = await apiClient.put<SuccessEnvelope<ActivityMutationResult>>(
      `/me/enrollments/${enrollmentId}/progress/last-visited-lesson`,
      input,
      { headers: mutationHeaders(idempotencyKey) },
    );
    return unwrap(response.data);
  },
};

export interface ProgressClientError {
  code: string | null;
  message: string;
  status: number | null;
}

export function toProgressClientError(error: unknown): ProgressClientError {
  if (!axios.isAxiosError<ApiErrorEnvelope>(error)) {
    return { code: null, message: progressMessages.errors.generic, status: null };
  }

  if (!error.response) {
    return { code: null, message: progressMessages.errors.network, status: null };
  }

  const code = error.response.data?.code ?? null;
  const translated =
    code && code in progressMessages.errors
      ? progressMessages.errors[code as keyof typeof progressMessages.errors]
      : progressMessages.errors.generic;

  return { code, message: translated, status: error.response.status };
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
