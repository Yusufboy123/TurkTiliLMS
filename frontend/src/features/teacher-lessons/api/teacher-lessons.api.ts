import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type {
  CreateTeacherBlockInput,
  CreateTeacherLessonInput,
  CreateTeacherSectionInput,
  TeacherContentBlock,
  TeacherContentBlockPage,
  TeacherLesson,
  TeacherLessonListQuery,
  TeacherLessonPage,
  TeacherSection,
  ReorderTeacherLessonInput,
  UpdateTeacherBlockInput,
  UpdateTeacherLessonInput,
  CreateTeacherVocabularyInput,
  TeacherVocabulary,
  UpdateTeacherVocabularyInput,
  CreateTeacherQuizQuestionInput,
  TeacherQuizQuestion,
  UpdateTeacherQuizQuestionInput,
  TeacherQuizResult,
  TeacherMediaFile,
  InteractivePracticeItem,
} from '../types/teacher-lessons.types';

export const teacherLessonsApi = {
  async listSections(courseId: string): Promise<TeacherSection[]> {
    const response = await apiClient.get<SuccessEnvelope<TeacherSection[]>>(
      `/courses/${courseId}/sections`,
    );
    return response.data.data;
  },
  async createSection(courseId: string, input: CreateTeacherSectionInput): Promise<TeacherSection> {
    const response = await apiClient.post<SuccessEnvelope<TeacherSection>>(
      `/courses/${courseId}/sections`,
      input,
    );
    return response.data.data;
  },
  async list(courseId: string, query: TeacherLessonListQuery): Promise<TeacherLessonPage> {
    const response = await apiClient.get<SuccessEnvelope<TeacherLessonPage>>(
      `/courses/${courseId}/lessons`,
      { params: query },
    );
    return response.data.data;
  },
  async get(courseId: string, lessonId: string): Promise<TeacherLesson> {
    const response = await apiClient.get<SuccessEnvelope<TeacherLesson>>(
      `/courses/${courseId}/lessons/${lessonId}`,
    );
    return response.data.data;
  },
  async create(courseId: string, input: CreateTeacherLessonInput): Promise<TeacherLesson> {
    const response = await apiClient.post<SuccessEnvelope<TeacherLesson>>(
      `/courses/${courseId}/lessons`,
      input,
    );
    return response.data.data;
  },
  async duplicate(courseId: string, lessonId: string): Promise<TeacherLesson> {
    const response = await apiClient.post<SuccessEnvelope<TeacherLesson>>(
      `/courses/${courseId}/lessons/${lessonId}/duplicate`,
    );
    return response.data.data;
  },
  async update(courseId: string, lessonId: string, input: UpdateTeacherLessonInput): Promise<TeacherLesson> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherLesson>>(
      `/courses/${courseId}/lessons/${lessonId}`,
      input,
    );
    return response.data.data;
  },
  async reorder(courseId: string, lessonId: string, input: ReorderTeacherLessonInput): Promise<TeacherLesson> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherLesson>>(
      `/courses/${courseId}/lessons/${lessonId}/position`,
      input,
    );
    return response.data.data;
  },
  async listBlocks(courseId: string, lessonId: string): Promise<TeacherContentBlockPage> {
    const response = await apiClient.get<SuccessEnvelope<TeacherContentBlockPage>>(
      `/courses/${courseId}/lessons/${lessonId}/blocks`,
      { params: { page: 1, pageSize: 50, includeDeleted: false } },
    );
    return response.data.data;
  },
  async createBlock(courseId: string, lessonId: string, input: CreateTeacherBlockInput): Promise<TeacherContentBlock> {
    const response = await apiClient.post<SuccessEnvelope<TeacherContentBlock>>(
      `/courses/${courseId}/lessons/${lessonId}/blocks`,
      input,
    );
    return response.data.data;
  },
  async updateBlock(courseId: string, lessonId: string, blockId: string, input: UpdateTeacherBlockInput): Promise<TeacherContentBlock> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherContentBlock>>(
      `/courses/${courseId}/lessons/${lessonId}/blocks/${blockId}`,
      input,
    );
    return response.data.data;
  },
  async upsertPracticeHolder(
    courseId: string,
    lessonId: string,
    interactivePractice: InteractivePracticeItem[],
  ): Promise<TeacherContentBlock> {
    const response = await apiClient.put<SuccessEnvelope<TeacherContentBlock>>(
      `/courses/${courseId}/lessons/${lessonId}/blocks/practice`,
      { interactivePractice },
    );
    return response.data.data;
  },
  async uploadMedia(file: File, onUploadProgress?: (percentage: number) => void): Promise<TeacherMediaFile> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<SuccessEnvelope<TeacherMediaFile>>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
    return response.data.data;
  },
  async listVocabulary(courseId: string, lessonId: string): Promise<TeacherVocabulary[]> {
    const response = await apiClient.get<SuccessEnvelope<TeacherVocabulary[]>>(`/courses/${courseId}/lessons/${lessonId}/vocabulary`);
    return response.data.data;
  },
  async createVocabulary(courseId: string, lessonId: string, input: CreateTeacherVocabularyInput): Promise<TeacherVocabulary> {
    const response = await apiClient.post<SuccessEnvelope<TeacherVocabulary>>(`/courses/${courseId}/lessons/${lessonId}/vocabulary`, input);
    return response.data.data;
  },
  async updateVocabulary(courseId: string, lessonId: string, vocabularyId: string, input: UpdateTeacherVocabularyInput): Promise<TeacherVocabulary> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherVocabulary>>(`/courses/${courseId}/lessons/${lessonId}/vocabulary/${vocabularyId}`, input);
    return response.data.data;
  },
  async deleteVocabulary(courseId: string, lessonId: string, vocabularyId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/lessons/${lessonId}/vocabulary/${vocabularyId}`);
  },
  async listQuizQuestions(courseId: string, lessonId: string): Promise<TeacherQuizQuestion[]> {
    const response = await apiClient.get<SuccessEnvelope<TeacherQuizQuestion[]>>(`/courses/${courseId}/lessons/${lessonId}/quiz/questions`);
    return response.data.data;
  },
  async createQuizQuestion(courseId: string, lessonId: string, input: CreateTeacherQuizQuestionInput): Promise<TeacherQuizQuestion> {
    const response = await apiClient.post<SuccessEnvelope<TeacherQuizQuestion>>(`/courses/${courseId}/lessons/${lessonId}/quiz/questions`, input);
    return response.data.data;
  },
  async updateQuizQuestion(courseId: string, lessonId: string, questionId: string, input: UpdateTeacherQuizQuestionInput): Promise<TeacherQuizQuestion> {
    const response = await apiClient.patch<SuccessEnvelope<TeacherQuizQuestion>>(`/courses/${courseId}/lessons/${lessonId}/quiz/questions/${questionId}`, input);
    return response.data.data;
  },
  async deleteQuizQuestion(courseId: string, lessonId: string, questionId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/lessons/${lessonId}/quiz/questions/${questionId}`);
  },
  async listQuizResults(courseId: string, lessonId: string): Promise<TeacherQuizResult[]> {
    const response = await apiClient.get<SuccessEnvelope<TeacherQuizResult[]>>(`/courses/${courseId}/lessons/${lessonId}/quiz/results`);
    return response.data.data;
  },
};
