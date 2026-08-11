import { describe, expect, it, vi } from 'vitest';
import { teacherLessonsApi } from '../src/features/teacher-lessons/api/teacher-lessons.api';
import { studentPlayerApi } from '../src/features/student-player/api/student-player.api';
import { validateTeacherMediaFile } from '../src/features/teacher-lessons/components/teacher-media-upload.validation';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mocks }));

describe('teacher quiz and vocabulary API contracts', () => {
  it('rejects unsupported media extensions before upload', () => {
    expect(validateTeacherMediaFile({ name: 'lesson.exe' }, 'AUDIO')).toContain('MP3 yoki WAV');
    expect(validateTeacherMediaFile({ name: 'lesson.mp3' }, 'AUDIO')).toBeNull();
  });

  it('uploads media through the authenticated multipart endpoint', async () => {
    mocks.post.mockResolvedValueOnce({ data: { data: { id: 'media-1', originalFileName: 'lesson.mp3', mimeType: 'audio/mpeg', category: 'AUDIO', sizeBytes: '4', storageProvider: 'LOCAL' } } });
    const file = new File(['data'], 'lesson.mp3', { type: 'audio/mpeg' });
    await teacherLessonsApi.uploadMedia(file, (percentage) => expect(percentage).toBeGreaterThanOrEqual(0));
    expect(mocks.post).toHaveBeenCalledWith('/media/upload', expect.any(FormData), expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }));
  });

  it('uses vocabulary CRUD endpoints', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: [] } });
    mocks.post.mockResolvedValueOnce({ data: { data: { id: 'v1' } } });
    mocks.patch.mockResolvedValueOnce({ data: { data: { id: 'v1' } } });
    mocks.delete.mockResolvedValueOnce({ data: { success: true } });
    await teacherLessonsApi.listVocabulary('c1', 'l1');
    await teacherLessonsApi.createVocabulary('c1', 'l1', { turkishWord: 'merhaba', uzbekMeaning: 'salom' });
    await teacherLessonsApi.updateVocabulary('c1', 'l1', 'v1', { uzbekMeaning: 'salomlashuv' });
    await teacherLessonsApi.deleteVocabulary('c1', 'l1', 'v1');
    expect(mocks.post).toHaveBeenCalledWith('/courses/c1/lessons/l1/vocabulary', expect.objectContaining({ turkishWord: 'merhaba' }));
    expect(mocks.patch).toHaveBeenCalledWith('/courses/c1/lessons/l1/vocabulary/v1', { uzbekMeaning: 'salomlashuv' });
    expect(mocks.delete).toHaveBeenCalledWith('/courses/c1/lessons/l1/vocabulary/v1');
  });

  it('uses supported quiz question and result endpoints', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: [] } }).mockResolvedValueOnce({ data: { data: [] } });
    mocks.post.mockResolvedValueOnce({ data: { data: { id: 'q1' } } });
    mocks.patch.mockResolvedValueOnce({ data: { data: { id: 'q1' } } });
    mocks.delete.mockResolvedValueOnce({ data: { success: true } });
    const question = { type: 'MULTIPLE_CHOICE' as const, prompt: 'Tanlang', points: 1, options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] };
    await teacherLessonsApi.listQuizQuestions('c1', 'l1');
    await teacherLessonsApi.createQuizQuestion('c1', 'l1', question);
    await teacherLessonsApi.updateQuizQuestion('c1', 'l1', 'q1', { prompt: 'Yangilangan' });
    await teacherLessonsApi.deleteQuizQuestion('c1', 'l1', 'q1');
    await teacherLessonsApi.listQuizResults('c1', 'l1');
    expect(mocks.post).toHaveBeenCalledWith('/courses/c1/lessons/l1/quiz/questions', question);
    expect(mocks.get).toHaveBeenLastCalledWith('/courses/c1/lessons/l1/quiz/results');
  });
});

describe('student quiz API contracts', () => {
  it('keeps student quiz operations enrollment-scoped', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: { lessonId: 'l1', questions: [] } } }).mockResolvedValueOnce({ data: { data: null } });
    mocks.post.mockResolvedValueOnce({ data: { data: { id: 'a1' } } }).mockResolvedValueOnce({ data: { data: { id: 'a1', status: 'SUBMITTED' } } });
    await studentPlayerApi.getQuiz('e1', 'l1');
    await studentPlayerApi.startQuiz('e1', 'l1');
    await studentPlayerApi.submitQuiz('e1', 'l1', 'a1', [{ questionId: 'q1', submittedAnswer: 'o1' }]);
    await studentPlayerApi.getLatestQuizResult('e1', 'l1');
    expect(mocks.get).toHaveBeenCalledWith('/enrollments/e1/lessons/l1/quiz');
    expect(mocks.post).toHaveBeenLastCalledWith('/enrollments/e1/lessons/l1/quiz/attempts/a1/submit', { answers: [{ questionId: 'q1', submittedAnswer: 'o1' }] });
  });
});
