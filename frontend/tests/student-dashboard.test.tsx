import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../src/features/auth/auth-context';
import { RequireAuthorization } from '../src/features/auth/RequireAuthorization';
import { createAuthSessionController } from '../src/features/auth/session/auth-session.controller';
import { createAuthSessionStore } from '../src/features/auth/session/auth-session.store';
import type {
  AuthApi,
  AuthenticationResult,
  RoleCode,
} from '../src/features/auth/types/auth.types';
import { certificateEligibilityQueryKeys } from '../src/features/certificate-eligibility/hooks/certificate-eligibility-query-keys';
import type { CertificateStatus } from '../src/features/certificate-eligibility/types/certificate-eligibility.types';
import { DashboardCertificateStatusView } from '../src/features/progress/components';
import { progressQueryKeys } from '../src/features/progress/hooks/progress-query-keys';
import StudentDashboardPage, {
  STUDENT_DASHBOARD_ACTIVE_LIMIT,
  STUDENT_DASHBOARD_COMPLETED_QUERY,
} from '../src/features/progress/pages/StudentDashboardPage';
import type {
  CompletedCoursePage,
  StudentProgressSummary,
} from '../src/features/progress/types/progress.types';
import {
  completedCoursesFixture,
  courseProgressFixture,
  progressSummaryFixture,
} from './progress-fixtures';

const emptySummary: StudentProgressSummary = {
  generatedAt: '2026-08-01T10:00:00.000Z',
  resumeLearning: null,
  activeCourseCount: 0,
  completedCourseCount: 0,
  activeCourses: [],
};

const emptyCompleted: CompletedCoursePage = {
  items: [],
  pagination: { page: 1, pageSize: 3, totalItems: 0, totalPages: 0 },
};

function authenticationResult(roles: RoleCode[] = ['STUDENT']): AuthenticationResult {
  return {
    accessToken: 'memory-only-dashboard-test-token',
    user: {
      id: '019e0000-0000-7000-8000-000000000001',
      email: 'student@turktili.local',
      firstName: 'Ali',
      lastName: 'Valiyev',
      status: 'ACTIVE',
      lastLoginAt: null,
    },
    roles,
    permissions: roles.includes('STUDENT') ? ['progress.self_read'] : [],
  };
}

function authContext(roles: RoleCode[] = ['STUDENT']): AuthContextValue {
  const session = authenticationResult(roles);
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
      queries: { staleTime: Infinity, retry: false, refetchOnMount: false },
    },
  });
}

function primeDashboard(
  client: QueryClient,
  summary: StudentProgressSummary = progressSummaryFixture,
  completed: CompletedCoursePage = emptyCompleted,
): void {
  client.setQueryData(progressQueryKeys.summary(STUDENT_DASHBOARD_ACTIVE_LIMIT), summary);
  client.setQueryData(progressQueryKeys.completed(STUDENT_DASHBOARD_COMPLETED_QUERY), completed);
}

function certificateStatus(
  status: CertificateStatus['status'],
  canDownload = status === 'ISSUED',
): CertificateStatus {
  const completed = completedCoursesFixture.items[0];
  return {
    enrollmentId: completed.enrollmentId,
    course: completed.course,
    status,
    certificate:
      status === 'NOT_ISSUED'
        ? null
        : {
            id: '019e0000-0000-7000-8000-000000000010',
            certificateId: '019e0000-0000-7000-8000-000000000010',
            certificateNumber: 'TTL-2026-0000000042',
            status,
            issuedAt: '2026-08-01T11:00:00.000Z',
            revokedAt: status === 'REVOKED' ? '2026-08-01T12:00:00.000Z' : null,
            safeRevocationReasonCode: status === 'REVOKED' ? 'ADMINISTRATIVE_ERROR' : null,
            version: status === 'REVOKED' ? 2 : 1,
            canDownload,
          },
    capabilities: {
      canReadEligibility: true,
      canReadCertificateStatus: true,
      canIssueCertificate: false,
      canRevokeCertificate: false,
    },
  };
}

function primeCertificate(client: QueryClient, status: CertificateStatus): void {
  client.setQueryData(
    certificateEligibilityQueryKeys.certificateStatus(
      { kind: 'self' },
      completedCoursesFixture.items[0].enrollmentId,
    ),
    status,
  );
}

function renderDashboard(client: QueryClient, context = authContext()): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <StudentDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Module 9.2 student dashboard', () => {
  it('renders accessible loading regions while both dashboard resources are pending', () => {
    const markup = renderDashboard(queryClient());

    expect(markup).toContain('Xush kelibsiz, Ali');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('O‘qish jarayoni yuklanmoqda');
  });

  it('renders independent empty states for a new student', () => {
    const client = queryClient();
    primeDashboard(client, emptySummary, emptyCompleted);

    const markup = renderDashboard(client);

    expect(markup).toContain('Faol kurslar yo‘q');
    expect(markup).toContain('Yakunlangan kurslar yo‘q');
    expect(markup).toContain('Davom ettirish uchun dars yo‘q');
  });

  it('keeps completed-course data usable while a failed summary is retried', async () => {
    const client = queryClient();
    client.setQueryData(
      progressQueryKeys.completed(STUDENT_DASHBOARD_COMPLETED_QUERY),
      completedCoursesFixture,
    );
    primeCertificate(client, certificateStatus('NOT_ISSUED'));
    await client.prefetchQuery({
      queryKey: progressQueryKeys.summary(STUDENT_DASHBOARD_ACTIVE_LIMIT),
      queryFn: async () => Promise.reject(new Error('summary unavailable')),
      retry: false,
    });

    const markup = renderDashboard(client);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('O‘qish jarayoni yuklanmoqda');
    expect(markup).toContain('Turk tili kirish kursi');
    expect(markup).toContain('Sertifikat hali berilmagan');
  });

  it('renders authoritative active-course progress and both navigation actions', () => {
    const client = queryClient();
    primeDashboard(client);

    const markup = renderDashboard(client);

    expect(markup).toContain('Turk tili A1');
    expect(markup).toContain('0/1 dars');
    expect(markup).toContain('Faol');
    expect(markup).toContain(
      `/learn/${courseProgressFixture.enrollmentId}/lessons/${courseProgressFixture.resumeTarget!.lesson.id}`,
    );
    expect(markup).toContain(`/app/progress/${courseProgressFixture.enrollmentId}`);
    expect(markup).toContain('Kursni davom ettirish');
  });

  it('does not guess a lesson when the backend provides no resume capability', () => {
    const client = queryClient();
    primeDashboard(client, {
      ...progressSummaryFixture,
      resumeLearning: null,
      activeCourses: [
        {
          ...courseProgressFixture,
          resumeTarget: null,
          capabilities: {
            ...courseProgressFixture.capabilities,
            canResumeLearning: false,
          },
        },
      ],
    });

    const markup = renderDashboard(client);

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Davom ettirish nuqtasi hali mavjud emas.');
    expect(markup).not.toContain('/learn/');
  });

  it('renders completed courses with NOT_ISSUED certificate status', () => {
    const client = queryClient();
    primeDashboard(client, { ...emptySummary, completedCourseCount: 1 }, completedCoursesFixture);
    primeCertificate(client, certificateStatus('NOT_ISSUED'));

    const markup = renderDashboard(client);

    expect(markup).toContain('Turk tili kirish kursi');
    expect(markup).toContain('Sertifikat hali berilmagan');
    expect(markup).not.toContain('Sertifikatni yuklab olish');
  });

  it('shows the existing private download action for an issued downloadable certificate', () => {
    const client = queryClient();
    primeDashboard(client, { ...emptySummary, completedCourseCount: 1 }, completedCoursesFixture);
    primeCertificate(client, certificateStatus('ISSUED', true));

    const markup = renderDashboard(client);

    expect(markup).toContain('Sertifikat berilgan');
    expect(markup).toContain('TTL-2026-0000000042');
    expect(markup).toContain('Sertifikatni yuklab olish');
  });

  it('renders revoked status without a download action', () => {
    const client = queryClient();
    primeDashboard(client, { ...emptySummary, completedCourseCount: 1 }, completedCoursesFixture);
    primeCertificate(client, certificateStatus('REVOKED', false));

    const markup = renderDashboard(client);

    expect(markup).toContain('Sertifikat bekor qilingan');
    expect(markup).not.toContain('Sertifikatni yuklab olish');
  });

  it('obeys canDownload=false even when lifecycle status is ISSUED', () => {
    const client = queryClient();
    primeDashboard(client, { ...emptySummary, completedCourseCount: 1 }, completedCoursesFixture);
    primeCertificate(client, certificateStatus('ISSUED', false));

    const markup = renderDashboard(client);

    expect(markup).toContain('Sertifikat berilgan');
    expect(markup).not.toContain('Sertifikatni yuklab olish');
  });

  it('keeps a certificate failure local and exposes an accessible retry action', () => {
    const markup = renderToStaticMarkup(
      <DashboardCertificateStatusView
        error={new Error('network failure')}
        isPending={false}
        onRetry={() => undefined}
        status={null}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Qayta urinish');
  });

  it('uses responsive dashboard grids without hiding equivalent progress text', () => {
    const client = queryClient();
    primeDashboard(client, progressSummaryFixture, completedCoursesFixture);
    primeCertificate(client, certificateStatus('NOT_ISSUED'));

    const markup = renderDashboard(client);

    expect(markup).toContain('lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]');
    expect(markup).toContain('md:grid-cols-2');
    expect(markup).toContain('0%');
    expect(markup).toContain('100%');
  });

  it.each(['TEACHER', 'ADMIN'] as const)(
    'keeps %s identities outside the student route boundary',
    (role) => {
      const client = queryClient();
      primeDashboard(client, emptySummary, emptyCompleted);
      const markup = renderToStaticMarkup(
        <AuthContext.Provider value={authContext([role])}>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/app']}>
              <Routes>
                <Route
                  element={
                    <RequireAuthorization
                      permissions={['progress.self_read']}
                      roles={['STUDENT']}
                    />
                  }
                >
                  <Route element={<StudentDashboardPage />} path="/app" />
                </Route>
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </AuthContext.Provider>,
      );

      expect(markup).toContain('Ruxsat mavjud emas');
      expect(markup).not.toContain('So‘nggi yakunlangan kurslar');
    },
  );

  it('preserves session restoration and logout behavior from Module 9.1', async () => {
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
