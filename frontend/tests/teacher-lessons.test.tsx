import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../src/features/auth/auth-context';
import type { AuthContextValue } from '../src/features/auth/auth-context';
import { RequireAuthorization } from '../src/features/auth/RequireAuthorization';
import { teacherLessonsApi } from '../src/features/teacher-lessons/api/teacher-lessons.api';
import { teacherLessonsQueryKeys } from '../src/features/teacher-lessons/hooks/teacher-lessons-query-keys';
import TeacherLessonDetailPage from '../src/features/teacher-lessons/pages/TeacherLessonDetailPage';
import TeacherLessonPreviewPage from '../src/features/teacher-lessons/pages/TeacherLessonPreviewPage';
import TeacherLessonsPage from '../src/features/teacher-lessons/pages/TeacherLessonsPage';
import { teacherLessonPaths } from '../src/features/teacher-lessons/teacher-lessons.routes';
import type {
  TeacherContentBlockPage,
  TeacherLesson,
  TeacherLessonPage,
  TeacherSection,
  TeacherQuizQuestion,
  TeacherVocabulary,
} from '../src/features/teacher-lessons/types/teacher-lessons.types';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mocks }));
vi.mock('../src/features/auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    roles: ['TEACHER'],
    permissions: ['sections.read', 'lessons.read', 'lessons.create', 'lessons.update', 'lesson_blocks.create', 'lesson_blocks.update'],
    user: { id: 'teacher-1', email: 'teacher@example.test' },
  }),
}));

const section: TeacherSection = {
  id: 'section-1',
  courseId: 'course-1',
  title: 'Boshlanish',
  description: null,
  position: 1,
  isPublished: false,
  deletedAt: null,
  lessonCount: 1,
};

const lesson: TeacherLesson = {
  id: 'lesson-1',
  courseId: 'course-1',
  section: { id: section.id, title: section.title, position: 1, isPublished: false, deletedAt: null },
  course: { id: 'course-1', title: 'A1 kurs', slug: 'a1-kurs' },
  title: 'Salomlashish',
  slug: 'salomlashish',
  summary: 'Oddiy salomlashuvlar.',
  content: null,
  lessonType: 'TEXT',
  position: 1,
  durationMinutes: null,
  isPreview: true,
  status: 'DRAFT',
  publishedAt: null,
  archivedAt: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  deletedAt: null,
};

const lessonPage: TeacherLessonPage = {
  items: [lesson],
  pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};
const blocks: TeacherContentBlockPage = {
  items: [
    {
      id: 'block-1',
      lessonId: lesson.id,
      mediaFileId: null,
      blockType: 'TEXT',
      title: 'Izoh',
      description: null,
      position: 1,
      isRequired: true,
      isVisible: true,
      textContent: 'Merhaba!',
      sourceUrl: null,
      externalProvider: null,
      fileUrl: null,
      mimeType: null,
      durationSeconds: null,
      thumbnailUrl: null,
      deletedAt: null,
    },
  ],
  pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
};

const listQuery = { page: 1, pageSize: 100, includeDeleted: false as const, sortBy: 'position' as const, sortDirection: 'asc' as const };

describe('teacher lesson management', () => {
  it('uses existing section, lesson, ordering, and content block APIs', async () => {
    mocks.get
      .mockResolvedValueOnce({ data: { data: [section] } })
      .mockResolvedValueOnce({ data: { data: lessonPage } })
      .mockResolvedValueOnce({ data: { data: lesson } })
      .mockResolvedValueOnce({ data: { data: blocks } });
    mocks.post
      .mockResolvedValueOnce({ data: { data: section } })
      .mockResolvedValueOnce({ data: { data: lesson } })
      .mockResolvedValueOnce({ data: { data: blocks.items[0] } })
      .mockResolvedValueOnce({ data: { data: lesson } });
    mocks.patch
      .mockResolvedValueOnce({ data: { data: lesson } })
      .mockResolvedValueOnce({ data: { data: lesson } })
      .mockResolvedValueOnce({ data: { data: blocks.items[0] } });

    await teacherLessonsApi.listSections('course-1');
    await teacherLessonsApi.list('course-1', listQuery);
    await teacherLessonsApi.get('course-1', 'lesson-1');
    await teacherLessonsApi.listBlocks('course-1', 'lesson-1');
    await teacherLessonsApi.createSection('course-1', { title: 'Yangi bo‘lim' });
    await teacherLessonsApi.create('course-1', { sectionId: section.id, title: lesson.title, lessonType: 'TEXT', isPreview: false });
    await teacherLessonsApi.duplicate('course-1', lesson.id);
    await teacherLessonsApi.update('course-1', lesson.id, { title: 'Yangilangan dars' });
    await teacherLessonsApi.reorder('course-1', lesson.id, { position: 2, sectionId: section.id });
    await teacherLessonsApi.createBlock('course-1', lesson.id, { blockType: 'TEXT', textContent: 'Matn', isRequired: true, isVisible: true });

    expect(teacherLessonPaths.list('course-1')).toBe('/teacher/courses/course-1/lessons');
    expect(teacherLessonPaths.new('course-1')).toBe('/teacher/courses/course-1/lessons/new');
    expect(mocks.post).toHaveBeenCalledWith('/courses/course-1/lessons', expect.objectContaining({ sectionId: section.id }));
    expect(mocks.patch).toHaveBeenCalledWith('/courses/course-1/lessons/lesson-1/position', { position: 2, sectionId: section.id });
    expect(mocks.post).toHaveBeenCalledWith('/courses/course-1/lessons/lesson-1/blocks', expect.objectContaining({ blockType: 'TEXT' }));
    expect(mocks.post).toHaveBeenCalledWith('/courses/course-1/lessons/lesson-1/duplicate');
  });

  it('renders ordered lessons and existing content blocks responsively', () => {
    const client = new QueryClient();
    client.setQueryData(teacherLessonsQueryKeys.sections('course-1'), [section]);
    client.setQueryData(teacherLessonsQueryKeys.list('course-1', listQuery), lessonPage);
    const listMarkup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/teacher/courses/course-1/lessons']}>
          <Routes>
            <Route path={teacherLessonPaths.listPattern} element={<TeacherLessonsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(listMarkup).toContain('Salomlashish');
    expect(listMarkup).toContain('Tartib: 1');
    expect(listMarkup).toContain('Preview');
    expect(listMarkup).toContain('md:grid-cols-2');

    client.setQueryData(teacherLessonsQueryKeys.detail('course-1', lesson.id), lesson);
    client.setQueryData(teacherLessonsQueryKeys.blocks('course-1', lesson.id), blocks);
    const detailMarkup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[teacherLessonPaths.detail('course-1', lesson.id)]}>
          <Routes>
            <Route path={teacherLessonPaths.detailPattern} element={<TeacherLessonDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(detailMarkup).toContain('Merhaba!');
    expect(detailMarkup).toContain('Blokni tahrirlash');
  });

  it('denies students lesson management access', () => {
    const student: AuthContextValue = {
      status: 'authenticated',
      reason: null,
      user: { id: 'student-1', email: 'student@example.test', firstName: 'Student', lastName: null, status: 'ACTIVE', lastLoginAt: null },
      roles: ['STUDENT'],
      permissions: ['progress.self_read'],
      login: async () => undefined,
      logout: async () => undefined,
      logoutAll: async () => undefined,
    };
    const markup = renderToStaticMarkup(
      <AuthContext.Provider value={student}>
        <MemoryRouter initialEntries={['/teacher/courses/course-1/lessons']}>
          <Routes>
            <Route element={<RequireAuthorization permissions={['sections.read', 'lessons.read']} roles={['ADMIN', 'TEACHER']} />}>
              <Route path={teacherLessonPaths.listPattern} element={<div>secret</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(markup).not.toContain('secret');
    expect(markup).toContain('Ruxsat mavjud emas');
  });

  it('renders a non-mutating student-style preview with vocabulary and quiz prompts', () => {
    const vocabulary: TeacherVocabulary = { id: 'word-1', lessonId: lesson.id, turkishWord: 'Merhaba', uzbekMeaning: 'Salom', exampleSentence: null, position: 1, createdAt: '', updatedAt: '' };
    const question: TeacherQuizQuestion = { id: 'question-1', lessonId: lesson.id, type: 'MULTIPLE_CHOICE', prompt: 'Salom nimani anglatadi?', explanation: 'hidden', points: 1, position: 1, options: [{ id: 'option-1', text: 'Salom', isCorrect: true, position: 1 }], createdAt: '', updatedAt: '' };
    const client = new QueryClient();
    client.setQueryData(teacherLessonsQueryKeys.detail('course-1', lesson.id), lesson);
    client.setQueryData(teacherLessonsQueryKeys.blocks('course-1', lesson.id), blocks);
    client.setQueryData(teacherLessonsQueryKeys.vocabulary('course-1', lesson.id), [vocabulary]);
    client.setQueryData(teacherLessonsQueryKeys.quizQuestions('course-1', lesson.id), [question]);
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[teacherLessonPaths.preview('course-1', lesson.id)]}>
          <Routes><Route path={teacherLessonPaths.previewPattern} element={<TeacherLessonPreviewPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(markup).toContain('Preview rejimi');
    expect(markup).toContain('Merhaba!');
    expect(markup).toContain('Yangi so‘zlar');
    expect(markup).toContain('Salom nimani anglatadi?');
    expect(markup).not.toContain('hidden');
    expect(markup).not.toContain('isCorrect');
  });
});
