import { describe, expect, it, vi } from 'vitest';
import { questionAnswersApi } from '../src/features/question-answers/question-answers.api';

const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mock }));

describe('teacher–student Q&A API', () => {
  it('uses the private student and teacher endpoints', async () => {
    mock.get.mockResolvedValue({ data: { data: { items: [], pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 } } } });
    mock.post.mockResolvedValue({ data: { data: { id: 'thread-1' } } });
    await questionAnswersApi.studentList();
    await questionAnswersApi.teacherList();
    await questionAnswersApi.create({ courseId: 'course-1', lessonId: 'lesson-1', body: 'Savol' });
    expect(mock.get).toHaveBeenNthCalledWith(1, '/me/questions', { params: { page: 1, pageSize: 50 } });
    expect(mock.get).toHaveBeenNthCalledWith(2, '/teacher/questions', { params: { page: 1, pageSize: 50 } });
    expect(mock.post).toHaveBeenCalledWith('/me/questions', { courseId: 'course-1', lessonId: 'lesson-1', body: 'Savol' });
  });
});
