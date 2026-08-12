import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '../src/lib/api-client';
import { studentProductivityApi } from '../src/features/student-productivity/student-productivity.api';

const originalAdapter = apiClient.defaults.adapter; let requests: InternalAxiosRequestConfig[] = [];
describe('student productivity API', () => {
  beforeEach(() => { requests = []; apiClient.defaults.adapter = (async (config) => { requests.push(config); return { data: { success: true, message: 'OK', data: config.method === 'get' ? [] : { id: 'bookmark-1' } }, status: 200, statusText: 'OK', headers: {}, config }; }) as AxiosAdapter; });
  afterEach(() => { apiClient.defaults.adapter = originalAdapter; });
  it('uses bookmark and private note endpoints', async () => {
    await studentProductivityApi.listBookmarks(); await studentProductivityApi.createBookmark({ lessonId: 'lesson-1' }); await studentProductivityApi.deleteBookmark('bookmark-1'); await studentProductivityApi.getNote('lesson-1'); await studentProductivityApi.saveNote('lesson-1', 'Qayd');
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual(['get /me/bookmarks', 'post /me/bookmarks', 'delete /me/bookmarks/bookmark-1', 'get /me/lessons/lesson-1/note', 'put /me/lessons/lesson-1/note']);
  });
});
