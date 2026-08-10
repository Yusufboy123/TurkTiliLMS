import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { studentCoursesApi } from '../src/features/student-courses/api/student-courses.api';
import { studentCoursesQueryKeys } from '../src/features/student-courses/hooks/student-courses-query-keys';
import { latestEnrollmentsByCourse } from '../src/features/student-courses/hooks/use-student-courses';
import StudentCoursesPage from '../src/features/student-courses/pages/StudentCoursesPage';
import { studentCoursesPaths } from '../src/features/student-courses/student-courses.routes';
import type {
  CatalogCoursePage,
  StudentEnrollment,
  StudentEnrollmentPage,
} from '../src/features/student-courses/types/student-courses.types';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));

const course = {
  id: '019f0000-0000-7000-8000-000000000001',
  title: 'Boshlang‘ich turk tili',
  slug: 'boshlangich-turk-tili',
  shortDescription: 'Mustaqil o‘qish uchun A1 kurs.',
  level: 'A1' as const,
  estimatedDurationMinutes: 90,
  publishedAt: '2026-08-01T00:00:00.000Z',
};

const catalog: CatalogCoursePage = {
  items: [course],
  pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

const enrollment: StudentEnrollment = {
  id: '019f0000-0000-7000-8000-000000000002',
  courseId: course.id,
  studentId: '019f0000-0000-7000-8000-000000000003',
  status: 'ACTIVE',
  enrolledAt: '2026-08-02T00:00:00.000Z',
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  suspendedAt: null,
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  course: { id: course.id, title: course.title, slug: course.slug },
};

function enrollmentPage(items: StudentEnrollment[]): StudentEnrollmentPage {
  return {
    items,
    pagination: { page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 },
  };
}

function renderPage(enrollments: StudentEnrollment[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnMount: false } },
  });
  client.setQueryData(studentCoursesQueryKeys.catalog(), catalog);
  client.setQueryData(studentCoursesQueryKeys.enrollments(), enrollmentPage(enrollments));
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StudentCoursesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('student course catalog', () => {
  it('renders catalog details and an unenrolled course action', () => {
    const markup = renderPage([]);
    expect(markup).toContain('Boshlang‘ich turk tili');
    expect(markup).toContain('Daraja: A1');
    expect(markup).toContain('Kursga yozilish');
    expect(markup).toContain('sm:grid-cols-2');
    expect(markup).toContain(studentCoursesPaths.list === '/app/courses' ? 'Bosh sahifaga qaytish' : '');
  });

  it('shows the already enrolled state and start link', () => {
    const markup = renderPage([enrollment]);
    expect(markup).toContain('Faol');
    expect(markup).toContain('Kursni boshlash');
    expect(markup).toContain(`/app/courses/${course.id}`);
    expect(markup).not.toContain('Kursga yozilish');
  });

  it('uses the existing catalog, own-enrollment, and self-enrollment APIs', async () => {
    mocks.get
      .mockResolvedValueOnce({ data: { data: catalog } })
      .mockResolvedValueOnce({ data: { data: enrollmentPage([]) } });
    mocks.post.mockResolvedValueOnce({ data: { data: enrollment } });

    await studentCoursesApi.listCatalog();
    await studentCoursesApi.listEnrollments();
    await studentCoursesApi.selfEnroll(course.id);

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/catalog/courses', {
      params: { page: 1, pageSize: 100, sortBy: 'sortOrder', sortDirection: 'asc' },
    });
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/me/enrollments', {
      params: { page: 1, pageSize: 100, sortBy: 'enrolledAt', sortDirection: 'desc' },
    });
    expect(mocks.post).toHaveBeenCalledWith(`/courses/${course.id}/enrollments/self`, {});
  });

  it('keeps the latest enrollment state for a course', () => {
    const cancelled = { ...enrollment, status: 'CANCELLED' as const, enrolledAt: '2026-08-01T00:00:00.000Z' };
    expect(latestEnrollmentsByCourse([cancelled, enrollment]).get(course.id)?.status).toBe('ACTIVE');
  });
});
