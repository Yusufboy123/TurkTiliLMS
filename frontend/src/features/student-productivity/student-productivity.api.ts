import { apiClient } from '../../lib/api-client';
import type { SuccessEnvelope } from '../progress';
import type { BookmarkItem, NoteItem } from './student-productivity.types';

export const studentProductivityApi = {
  async listBookmarks(): Promise<BookmarkItem[]> { const response = await apiClient.get<SuccessEnvelope<BookmarkItem[]>>('/me/bookmarks'); return response.data.data; },
  async createBookmark(input: { lessonId?: string; vocabularyId?: string }): Promise<BookmarkItem> { const response = await apiClient.post<SuccessEnvelope<BookmarkItem>>('/me/bookmarks', input); return response.data.data; },
  async deleteBookmark(id: string): Promise<void> { await apiClient.delete(`/me/bookmarks/${id}`); },
  async getNote(lessonId: string): Promise<NoteItem | null> { const response = await apiClient.get<SuccessEnvelope<NoteItem | null>>(`/me/lessons/${lessonId}/note`); return response.data.data; },
  async saveNote(lessonId: string, content: string): Promise<NoteItem> { const response = await apiClient.put<SuccessEnvelope<NoteItem>>(`/me/lessons/${lessonId}/note`, { content }); return response.data.data; },
  async deleteNote(lessonId: string): Promise<void> { await apiClient.delete(`/me/lessons/${lessonId}/note`); },
};
