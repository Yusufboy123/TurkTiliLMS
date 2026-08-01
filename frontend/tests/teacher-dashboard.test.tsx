import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../src/features/auth/auth-context';
import { RequireAuthorization } from '../src/features/auth/RequireAuthorization';
import { createAuthSessionController } from '../src/features/auth/session/auth-session.controller';
import { createAuthSessionStore } from '../src/features/auth/session/auth-session.store';
import type {
  AuthApi,
  AuthenticationResult,
  RoleCode,
} from '../src/features/auth/types/auth.types';
import {
  progressReportingQueryKeys,
  type TeacherCourseProgressPage,
} from '../src/features/progress-reporting';
import {
  teacherDashboardApi,
  teacherDashboardCourseQuery,
  teacherDashboardQueryKeys,
  TEACHER_DASHBOARD_REPORT_QUERY,
  normalizeTeacherDashboardPage,
  type AssignedTeacherCourse,
  type AssignedTeacherCoursePage,
} from '../src/features/teacher-dashboard';
import { TeacherCourseReportView } from '../src/features/teacher-dashboard/components';
import TeacherDashboardPage from '../src/features/teacher-dashboard/pages/TeacherDashboardPage';
import { apiClient } from '../src/lib/api-client';

const firstCourse: AssignedTeacherCourse = {
  id: '019e0000-0000-7000-8000-000000000101',
  title: 'Turk tili A1: kundalik muloqot',
  slug: 'turk-tili-a1-kundalik-muloqot',
  level: 'A1',
  status: 'PUBLISHED',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

const secondCourse: AssignedTeacherCourse = {
  id: '019e0000-0000-7000-8000-000000000102',
  title: 'Turk tili A2',
  slug: 'turk-tili-a2',
  level: 'A2',
  status: 'IN_REVIEW',
  updatedAt: '2026-07-31T10:00:00.000Z',
};

const assignedCourses: AssignedTeacherCoursePage = {
  items: [firstCourse, secondCourse],
  pagination: { page: 1, pageSize: 6, totalItems: 2, totalPages: 1 },
};

function reportFor(
  course: AssignedTeacherCourse,
  overrides: Partial<TeacherCourseProgressPage> = {},
): TeacherCourseProgressPage {
  return {
    course: { id: course.id, title: course.title, slug: course.slug },
    curriculumVersion: 3,
    activeEnrollmentCount: 8,
    suspendedEnrollmentCount: 1,
    completedEnrollmentCount: 4,
    cancelledEnrollmentCount: 2,
    averageProgressPercentage: 62,
    items: [],
    pagination: { page: 1, pageSize: 1, totalItems: 15, totalPages: 15 },
    capabilities: {
      canReadDetail: true,
      canExport: false,
      exportRequiresStepUp: true,
    },
    ...overrides,
  };
}

function authenticationResult(
  roles: RoleCode[] = ['TEACHER'],
  permissions: string[] = ['courses.read', 'progress.course.read'],
): AuthenticationResult {
  return {
    accessToken: 'memory-only-teacher-dashboard-token',
    user: {
      id: '019e0000-0000-7000-8000-000000000100',
      email: 'teacher@turktili.local',
      firstName: 'Dilshod',
      lastName: 'Ustoz',
      status: 'ACTIVE',
      lastLoginAt: null,
    },
    roles,
    permissions,
  };
}

function authContext(
  roles: RoleCode[] = ['TEACHER'],
  permissions: string[] = ['courses.read', 'progress.course.read'],
): AuthContextValue {
  const session = authenticationResult(roles, permissions);
  return {
    status: 'authenticated',
    reason: null,
    user: session.user,
    roles: session.roles,
    permissions: session.permissions,
    login: async () => undefined,
    logout: async () => undefined,
    logoutAll: async () => undefined,
  };
}

function queryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
      },
    },
  });
}

function primeDashboard(
  client: QueryClient,
  courses: AssignedTeacherCoursePage = assignedCourses,
): void {
  client.setQueryData(teacherDashboardQueryKeys.courses(teacherDashboardCourseQuery(1)), courses);
  for (const course of courses.items) {
    client.setQueryData(
      progressReportingQueryKeys.teacherCourse(course.id, TEACHER_DASHBOARD_REPORT_QUERY),
      reportFor(course),
    );
  }
}

function renderDashboard(client: QueryClient, initialEntry = '/teacher'): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={authContext()}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <TeacherDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

function renderAuthorization(roles: RoleCode[], permissions: string[]): string {
  const client = queryClient();
  primeDashboard(client);
  return renderToStaticMarkup(
    <AuthContext.Provider value={authContext(roles, permissions)}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/teacher']}>
          <Routes>
            <Route
              element={
                <RequireAuthorization
                  permissions={['courses.read', 'progress.course.read']}
                  roles={['TEACHER']}
                />
              }
            >
              <Route element={<TeacherDashboardPage />} path="/teacher" />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

const originalAdapter = apiClient.defaults.adapter;
let requests: InternalAxiosRequestConfig[] = [];

function mockAdapter(data: unknown): AxiosAdapter {
  return async (config) => {
    requests.push(config);
    return {
      data: { success: true, message: 'OK', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
}

describe('Module 9.3 Teacher Dashboard API and cache', () => {
  beforeEach(() => {
    requests = [];
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('uses the existing scoped course-list endpoint with bounded pagination', async () => {
    const query = teacherDashboardCourseQuery(2);
    apiClient.defaults.adapter = mockAdapter(assignedCourses);

    await expect(teacherDashboardApi.getAssignedCourses(query)).resolves.toEqual(assignedCourses);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'get', url: '/courses', params: query });
    expect(query).toEqual({
      page: 2,
      pageSize: 6,
      deleted: 'exclude',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  });

  it('creates page-aware assigned-course query keys', () => {
    expect(teacherDashboardQueryKeys.courses(teacherDashboardCourseQuery(1))).not.toEqual(
      teacherDashboardQueryKeys.courses(teacherDashboardCourseQuery(2)),
    );
  });

  it('normalizes empty and out-of-range pages to a reachable page', () => {
    expect(normalizeTeacherDashboardPage(9, 2)).toBe(2);
    expect(normalizeTeacherDashboardPage(3, 0)).toBe(1);
    expect(normalizeTeacherDashboardPage(1, 4)).toBe(1);
  });
});

describe('Module 9.3 Teacher Dashboard presentation', () => {
  it('renders an accessible loading state', () => {
    const markup = renderDashboard(queryClient());

    expect(markup).toContain('role="status"');
    expect(markup).toContain('O‘qituvchi paneli yuklanmoqda');
  });

  it('renders an administrator-assignment empty state', () => {
    const client = queryClient();
    primeDashboard(client, {
      items: [],
      pagination: { page: 1, pageSize: 6, totalItems: 0, totalPages: 0 },
    });

    const markup = renderDashboard(client);

    expect(markup).toContain('Biriktirilgan kurslar yo‘q');
    expect(markup).toContain('administratorga murojaat qiling');
    expect(markup).toContain('<h3');
  });

  it('renders a safe retryable error when assigned courses cannot be loaded', async () => {
    const client = queryClient();
    await client.prefetchQuery({
      queryKey: teacherDashboardQueryKeys.courses(teacherDashboardCourseQuery(1)),
      queryFn: async () => Promise.reject(new Error('C:\\private\\course-list.ts')),
      retry: false,
    });

    const markup = renderDashboard(client);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Qayta urinish');
    expect(markup).not.toContain('private');
    expect(markup).not.toContain('course-list.ts');
    expect(markup).toContain('<h3');
  });

  it('does not present an out-of-range page as a genuine empty dashboard', () => {
    const client = queryClient();
    client.setQueryData(teacherDashboardQueryKeys.courses(teacherDashboardCourseQuery(9)), {
      items: [],
      pagination: { page: 9, pageSize: 6, totalItems: 8, totalPages: 2 },
    } satisfies AssignedTeacherCoursePage);

    const markup = renderDashboard(client, '/teacher?page=9');

    expect(markup).toContain('O‘qituvchi paneli yuklanmoqda');
    expect(markup).not.toContain('Biriktirilgan kurslar yo‘q');
  });

  it('renders assigned courses and backend-authoritative progress summaries', () => {
    const client = queryClient();
    primeDashboard(client);

    const markup = renderDashboard(client);

    expect(markup).toContain(firstCourse.title);
    expect(markup).toContain(secondCourse.title);
    expect(markup).toContain('Jami 2 ta kurs biriktirilgan');
    expect(markup).toContain('>15<');
    expect(markup).toContain('>8<');
    expect(markup).toContain('>4<');
    expect(markup).toContain('62%');
  });

  it('builds only registered teacher reporting links', () => {
    const client = queryClient();
    primeDashboard(client);

    const markup = renderDashboard(client);

    expect(markup).toContain(`/teacher/courses/${firstCourse.id}/progress`);
    expect(markup).toContain(`/teacher/courses/${secondCourse.id}/progress`);
    expect(markup).not.toContain('/admin/progress');
  });

  it('renders bounded dashboard pagination with accessible controls', () => {
    const client = queryClient();
    primeDashboard(client, {
      items: [firstCourse],
      pagination: { page: 1, pageSize: 6, totalItems: 8, totalPages: 2 },
    });

    const markup = renderDashboard(client);

    expect(markup).toContain('aria-label="Biriktirilgan kurslar sahifalari"');
    expect(markup).toContain('Sahifa 1/2');
    expect(markup).toContain('disabled=""');
  });

  it('keeps a course-summary failure local and retryable', () => {
    const markup = renderToStaticMarkup(
      <TeacherCourseReportView
        courseId={firstCourse.id}
        courseTitle={firstCourse.title}
        error={new Error('network failure')}
        isPending={false}
        onRetry={() => undefined}
        report={null}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Kurs o‘zlashtirish xulosasini yuklab bo‘lmadi.');
    expect(markup).toContain('Qayta urinish');
  });

  it('uses responsive grids, wrapping and explicit progress text', () => {
    const client = queryClient();
    primeDashboard(client);

    const markup = renderDashboard(client);

    expect(markup).toContain('md:grid-cols-2');
    expect(markup).toContain('xl:grid-cols-3');
    expect(markup).toContain('overflow-wrap-anywhere');
    expect(markup).toContain('O‘rtacha o‘zlashtirish');
    expect(markup).toContain(`${firstCourse.title}: o‘rtacha o‘zlashtirish`);
  });
});

describe('Module 9.3 Teacher Dashboard authorization and session regressions', () => {
  it('allows a teacher with both existing permissions', () => {
    expect(renderAuthorization(['TEACHER'], ['courses.read', 'progress.course.read'])).toContain(
      'O‘qituvchi boshqaruv paneli',
    );
  });

  it.each([
    { roles: ['STUDENT'] as RoleCode[], permissions: ['courses.read', 'progress.course.read'] },
    { roles: ['ADMIN'] as RoleCode[], permissions: ['courses.read', 'progress.course.read'] },
    { roles: ['TEACHER'] as RoleCode[], permissions: ['courses.read'] },
  ])('denies an unauthorized identity without rendering course data', ({ roles, permissions }) => {
    const markup = renderAuthorization(roles, permissions);

    expect(markup).toContain('Ruxsat mavjud emas');
    expect(markup).not.toContain(firstCourse.title);
  });

  it('preserves session restoration and logout behavior', async () => {
    const store = createAuthSessionStore();
    const api: AuthApi = {
      login: vi.fn(async () => authenticationResult()),
      refresh: vi.fn(async () => authenticationResult()),
      logout: vi.fn(async () => undefined),
      logoutAll: vi.fn(async () => undefined),
    };
    const controller = createAuthSessionController(api, store);

    await controller.bootstrap();
    expect(store.getSnapshot().status).toBe('authenticated');

    await controller.logout();
    expect(api.logout).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'unauthenticated', reason: 'SIGNED_OUT' }),
    );
  });
});
