import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../auth/types/auth.types';
import type { StudentLessonBlock, StudentLessonContent } from '../types/student-player.types';

export const studentPlayerApi = {
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
};
