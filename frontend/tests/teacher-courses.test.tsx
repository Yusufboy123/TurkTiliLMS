import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { teacherCoursesApi } from '../src/features/teacher-courses/api/teacher-courses.api';
import TeacherCoursesPage from '../src/features/teacher-courses/pages/TeacherCoursesPage';
import { teacherCoursesQueryKeys } from '../src/features/teacher-courses/hooks/teacher-courses-query-keys';
import { teacherCoursePaths } from '../src/features/teacher-courses/teacher-courses.routes';
import type { TeacherCoursePage } from '../src/features/teacher-courses/types/teacher-courses.types';
import { AuthContext } from '../src/features/auth/auth-context';
import { RequireAuthorization } from '../src/features/auth/RequireAuthorization';
import type { AuthContextValue } from '../src/features/auth/auth-context';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mocks }));
vi.mock('../src/features/auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    roles: ['TEACHER'],
    permissions: ['courses.read', 'courses.create', 'courses.update', 'courses.submit_review'],
    user: { id: 'teacher-1', email: 'teacher@example.test' },
  }),
}));

const page: TeacherCoursePage = {
  items: [
    {
      id: 'course-1',
      title: 'A1 Turk tili',
      slug: 'a1-turk-tili',
      shortDescription: 'Boshlang‘ich kurs.',
      description: null,
      contentLanguage: 'tr',
      level: 'A1',
      status: 'DRAFT',
      teacher: null,
      estimatedDurationMinutes: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      deletedAt: null,
    },
  ],
  pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
};

const listQuery = {
  page: 1,
  pageSize: 50,
  deleted: 'exclude' as const,
  sortBy: 'updatedAt' as const,
  sortDirection: 'desc' as const,
};

describe('teacher course management', () => {
  it('keeps management routes and existing CRUD/status endpoints stable', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: page } });
    mocks.get.mockResolvedValueOnce({ data: { data: page.items[0] } });
    mocks.post.mockResolvedValueOnce({ data: { data: page.items[0] } });
    mocks.patch
      .mockResolvedValueOnce({ data: { data: page.items[0] } })
      .mockResolvedValueOnce({ data: { data: page.items[0] } });

    await teacherCoursesApi.list({
      page: 1,
      pageSize: 50,
      deleted: 'exclude',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    await teacherCoursesApi.get('course-1');
    await teacherCoursesApi.create({ title: 'Yangi kurs', level: 'A1' });
    await teacherCoursesApi.update('course-1', { title: 'Yangilangan kurs' });
    await teacherCoursesApi.updateStatus('course-1', 'IN_REVIEW');

    expect(teacherCoursePaths.list).toBe('/teacher/courses');
    expect(teacherCoursePaths.new).toBe('/teacher/courses/new');
    expect(teacherCoursePaths.detail('course-1')).toBe('/teacher/courses/course-1');
    expect(mocks.post).toHaveBeenCalledWith('/courses', { title: 'Yangi kurs', level: 'A1' });
    expect(mocks.patch).toHaveBeenNthCalledWith(1, '/courses/course-1', { title: 'Yangilangan kurs' });
    expect(mocks.patch).toHaveBeenNthCalledWith(2, '/courses/course-1/status', { status: 'IN_REVIEW' });
  });

  it('renders a responsive owned-course list with create and open actions', () => {
    const client = new QueryClient();
    client.setQueryData(teacherCoursesQueryKeys.list(listQuery), page);
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TeacherCoursesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(markup).toContain('A1 Turk tili');
    expect(markup).toContain('Daraja: A1');
    expect(markup).toContain('Qoralama');
    expect(markup).toContain('Kursni ochish');
    expect(markup).toContain('Yangi kurs yaratish');
    expect(markup).toContain('sm:grid-cols-2');
  });

  it('denies a student the management route', () => {
    const student: AuthContextValue = {
      status: 'authenticated',
      reason: null,
      user: {
        id: 'student-1',
        email: 'student@example.test',
        firstName: 'Student',
        lastName: null,
        status: 'ACTIVE',
        lastLoginAt: null,
      },
      roles: ['STUDENT'],
      permissions: ['enrollments.self_read'],
      login: async () => undefined,
      logout: async () => undefined,
      logoutAll: async () => undefined,
    };
    const markup = renderToStaticMarkup(
      <AuthContext.Provider value={student}>
        <MemoryRouter initialEntries={['/teacher/courses']}>
          <Routes>
            <Route element={<RequireAuthorization permissions={['courses.read']} roles={['ADMIN', 'TEACHER']} />}>
              <Route path="/teacher/courses" element={<div>secret</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(markup).not.toContain('secret');
    expect(markup).toContain('Ruxsat mavjud emas');
  });
});
