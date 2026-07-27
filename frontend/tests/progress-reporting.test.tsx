import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppQueryClient } from '../src/app/query-client';
import { ToastProvider } from '../src/components';
import { AuthProvider, RequireAuthorization } from '../src/features/auth';
import { createAuthSessionController } from '../src/features/auth/session/auth-session.controller';
import { createAuthSessionStore } from '../src/features/auth/session/auth-session.store';
import type { AuthApi, AuthenticationResult } from '../src/features/auth/types/auth.types';
import { progressReportingApi } from '../src/features/progress-reporting/api/progress-reporting.api';
import {
  PermissionDeniedState,
  ReportingEmptyState,
  ReportingError,
  ReportingPagination,
  ReportingSkeleton,
  ReportingSummary,
  StudentProgressTable,
} from '../src/features/progress-reporting/components';
import { progressReportingQueryKeys } from '../src/features/progress-reporting/hooks/progress-reporting-query-keys';
import { useAdminReporting } from '../src/features/progress-reporting/hooks/use-progress-reporting';
import { progressReportingPaths } from '../src/features/progress-reporting/progress-reporting.routes';
import type {
  AdminProgressPage,
  ProgressReportingQuery,
  StudentProgressDetail,
  TeacherCourseProgressPage,
} from '../src/features/progress-reporting/types/progress-reporting.types';
import {
  reportingQueryFrom,
  reportingSearchParams,
} from '../src/features/progress-reporting/utils/reporting-query';
import { apiClient } from '../src/lib/api-client';
import { courseProgressFixture } from './progress-fixtures';

const courseId = courseProgressFixture.course.id;
const enrollmentId = courseProgressFixture.enrollmentId;
const student = {
  id: '019c0000-0000-7000-8000-000000000020',
  email: 'student@example.com',
  firstName: 'Ali',
  lastName: 'Valiyev',
  displayName: 'Ali Valiyev',
};
const query: ProgressReportingQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'lastActivityAt',
  sortDirection: 'desc',
};
const item = {
  enrollmentId,
  student,
  enrollmentStatus: 'ACTIVE' as const,
  progressStatus: 'IN_PROGRESS' as const,
  percentage: 25,
  completedLessons: 1,
  totalEligibleLessons: 4,
  lastActivityAt: '2026-07-27T08:00:00.000Z',
  completedAt: null,
  capabilities: {
    canReadDetail: true,
    canExport: false as const,
    exportRequiresStepUp: true as const,
  },
};
const teacherPage: TeacherCourseProgressPage = {
  course: courseProgressFixture.course,
  curriculumVersion: 3,
  activeEnrollmentCount: 10,
  suspendedEnrollmentCount: 1,
  completedEnrollmentCount: 4,
  cancelledEnrollmentCount: 2,
  averageProgressPercentage: 46,
  items: [item],
  pagination: { page: 1, pageSize: 20, totalItems: 17, totalPages: 1 },
  capabilities: item.capabilities,
};
const adminPage: AdminProgressPage = {
  generatedAt: '2026-07-27T08:00:00.000Z',
  totalEnrollments: 17,
  activeLearners: 10,
  completedEnrollments: 4,
  averageProgressPercentage: 46,
  items: [item],
  pagination: teacherPage.pagination,
  capabilities: item.capabilities,
};
const detail: StudentProgressDetail = {
  student,
  progress: {
    ...courseProgressFixture,
    resumeTarget: null,
    capabilities: {
      ...courseProgressFixture.capabilities,
      canAccessCourseContent: false,
      canNavigateCurriculum: false,
      canDownloadPermittedMedia: false,
      canRecordActivity: false,
      canResumeLearning: false,
      canCompleteBlock: false,
      canReopenBlock: false,
      canCompleteLesson: false,
      canReopenLesson: false,
    },
  },
  capabilities: item.capabilities,
};

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

describe('progress reporting API contract', () => {
  beforeEach(() => {
    requests = [];
  });
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('uses only the four approved reporting endpoints', async () => {
    apiClient.defaults.adapter = mockAdapter(teacherPage);
    await progressReportingApi.getTeacherCourse(courseId, query);
    await progressReportingApi.getTeacherEnrollment(courseId, enrollmentId);
    await progressReportingApi.getAdmin(query);
    await progressReportingApi.getAdminEnrollment(enrollmentId);

    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `get /courses/${courseId}/progress`,
      `get /courses/${courseId}/progress/enrollments/${enrollmentId}`,
      'get /progress',
      `get /progress/enrollments/${enrollmentId}`,
    ]);
    expect(requests.every(({ method }) => method === 'get')).toBe(true);
  });

  it('passes only approved pagination, search, filtering, and sorting parameters', async () => {
    apiClient.defaults.adapter = mockAdapter(adminPage);
    await progressReportingApi.getAdmin({
      ...query,
      page: 2,
      search: 'Ali',
      courseId,
      studentId: student.id,
      enrollmentStatus: 'ACTIVE',
      progressState: 'IN_PROGRESS',
      sortBy: 'studentName',
      sortDirection: 'asc',
    });
    expect(requests[0].params).toEqual({
      page: 2,
      pageSize: 20,
      search: 'Ali',
      courseId,
      studentId: student.id,
      enrollmentStatus: 'ACTIVE',
      progressState: 'IN_PROGRESS',
      sortBy: 'studentName',
      sortDirection: 'asc',
    });
  });
});

describe('progress reporting query and cache isolation', () => {
  it('creates stable role, course, enrollment, filter, and pagination-aware keys', () => {
    const first = progressReportingQueryKeys.teacherCourse(courseId, {
      ...query,
      search: 'Ali',
    });
    const second = progressReportingQueryKeys.teacherCourse(courseId, {
      ...query,
      search: 'Ali',
    });
    expect(first).toEqual(second);
    expect(first).not.toEqual(progressReportingQueryKeys.admin({ ...query, search: 'Ali' }));
    expect(progressReportingQueryKeys.teacherEnrollment(courseId, enrollmentId)).not.toEqual(
      progressReportingQueryKeys.adminEnrollment(enrollmentId),
    );
  });

  it('renders the admin hook from authoritative cached data', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(progressReportingQueryKeys.admin(query), adminPage);
    function Probe() {
      const result = useAdminReporting(query);
      return <p>{result.data?.totalEnrollments}</p>;
    }
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    expect(markup).toContain('17');
  });

  it('removes role-scoped reporting data when the shared logout cleanup clears the cache', () => {
    const client = createAppQueryClient();
    client.setQueryData(progressReportingQueryKeys.admin(query), adminPage);
    client.setQueryData(progressReportingQueryKeys.teacherCourse(courseId, query), teacherPage);
    client.clear();
    expect(client.getQueryCache().findAll()).toHaveLength(0);
  });

  it('normalizes supported URL filters and resets invalid values to contract defaults', () => {
    const parsed = reportingQueryFrom(
      new URLSearchParams(
        `page=2&pageSize=10&search=Ali&courseId=${courseId}&enrollmentStatus=ACTIVE&progressState=IN_PROGRESS&sortBy=percentage&sortDirection=asc`,
      ),
    );
    expect(parsed).toMatchObject({
      page: 2,
      pageSize: 10,
      search: 'Ali',
      enrollmentStatus: 'ACTIVE',
      progressState: 'IN_PROGRESS',
      sortBy: 'percentage',
      sortDirection: 'asc',
    });
    expect(reportingQueryFrom(new URLSearchParams('page=0&pageSize=101&sortBy=unknown'))).toEqual(
      query,
    );
    expect(reportingQueryFrom(reportingSearchParams(parsed))).toEqual(parsed);
  });
});

function sessionResult(roles: AuthenticationResult['roles'], permissions: string[]) {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token-long-enough-for-contract',
    user: {
      id: '019c0000-0000-7000-8000-000000000030',
      email: 'actor@example.com',
      firstName: 'Actor',
      lastName: null,
      status: 'ACTIVE' as const,
      lastLoginAt: null,
    },
    roles,
    permissions,
  };
}

function authApi(): AuthApi {
  return {
    login: async () => sessionResult(['ADMIN'], ['progress.read']),
    refresh: async () => sessionResult(['ADMIN'], ['progress.read']),
    logout: async () => undefined,
    logoutAll: async () => undefined,
  };
}

function authorizationMarkup(roles: AuthenticationResult['roles'], permissions: string[]) {
  const store = createAuthSessionStore();
  store.establish(sessionResult(roles, permissions));
  const controller = createAuthSessionController(authApi(), store);
  return renderToStaticMarkup(
    <AuthProvider controller={controller} store={store}>
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route
            element={<RequireAuthorization permissions={['progress.read']} roles={['ADMIN']} />}
          >
            <Route path="/report" element={<p>Maxfiy hisobot</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('progress reporting authorization and presentation', () => {
  it('allows the exact role and permission and renders explicit denial otherwise', () => {
    expect(authorizationMarkup(['ADMIN'], ['progress.read'])).toContain('Maxfiy hisobot');
    expect(authorizationMarkup(['TEACHER'], ['progress.read'])).toContain('Ruxsat mavjud emas');
    expect(authorizationMarkup(['ADMIN'], [])).toContain('Ruxsat mavjud emas');
  });

  it('renders summary, responsive accessible table, sort state, and pagination', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ReportingSummary active={10} average={46} completed={4} total={17} />
        <StudentProgressTable
          detailPath={progressReportingPaths.adminEnrollment}
          items={[item]}
          query={{ ...query, sortBy: 'percentage' }}
        />
        <ReportingPagination
          onPageChange={() => undefined}
          pagination={{ page: 1, pageSize: 20, totalItems: 40, totalPages: 2 }}
        />
      </MemoryRouter>,
    );
    expect(markup).toContain('<table');
    expect(markup).toContain('aria-sort="descending"');
    expect(markup).toContain('Ali Valiyev');
    expect(markup).toContain('Sahifa 1/2');
    expect(markup).not.toContain('Materialni tugallash');
    expect(markup).not.toContain('Darsni qayta ochish');
    expect(detail.progress.capabilities.canCompleteLesson).toBe(false);
  });

  it('renders empty, permission-denied, and safe error states without raw stack details', () => {
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <ReportingSkeleton />
        <ReportingEmptyState />
        <PermissionDeniedState />
        <ReportingError
          error={new Error('C:\\private\\backend\\stack.ts')}
          onRetry={() => undefined}
        />
      </ToastProvider>,
    );
    expect(markup).toContain('Natija topilmadi');
    expect(markup).toContain('Ruxsat mavjud emas');
    expect(markup).not.toContain('private');
    expect(markup).not.toContain('stack.ts');
  });
});
