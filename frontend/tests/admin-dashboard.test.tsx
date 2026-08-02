import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionDeniedState } from '../src/components';
import {
  adminDashboardApi,
  adminDashboardPaths,
  adminDashboardQueryKeys,
  adminDashboardRequiredPermissions,
  formatAdminDashboardSnapshot,
  type AdminDashboardSummary,
} from '../src/features/admin-dashboard';
import {
  AdminDashboardError,
  AdminSummarySection,
} from '../src/features/admin-dashboard/components';
import AdminDashboardPage from '../src/features/admin-dashboard/pages/AdminDashboardPage';
import { AuthContext, type AuthContextValue } from '../src/features/auth/auth-context';
import { defaultAuthenticatedPath } from '../src/features/auth/auth.routes';
import { RequireAuthentication } from '../src/features/auth/RequireAuthentication';
import { RequireAuthorization } from '../src/features/auth/RequireAuthorization';
import { createAuthSessionController } from '../src/features/auth/session/auth-session.controller';
import { createAuthSessionStore } from '../src/features/auth/session/auth-session.store';
import type {
  AuthApi,
  AuthenticationResult,
  RoleCode,
} from '../src/features/auth/types/auth.types';
import { apiClient } from '../src/lib/api-client';
import { adminDashboardMessages } from '../src/locales/uz-Latn/admin-dashboard';

const fullPermissions = [...adminDashboardRequiredPermissions];

const summary: AdminDashboardSummary = {
  generatedAt: '2026-08-01T10:00:00.000Z',
  users: {
    total: 120,
    active: 109,
    suspended: 3,
    deactivated: 6,
    deleted: 2,
    students: 102,
    teachers: 14,
    administrators: 4,
  },
  courses: {
    total: 18,
    draft: 4,
    inReview: 2,
    published: 10,
    archived: 1,
    deleted: 1,
  },
  enrollments: {
    total: 480,
    active: 350,
    suspended: 10,
    completed: 100,
    cancelled: 20,
  },
  progress: {
    trackedEnrollments: 430,
    averageCompletionPercentage: 64,
  },
  certificates: {
    total: 72,
    issued: 68,
    revoked: 4,
  },
};

function authenticationResult(
  roles: RoleCode[] = ['ADMIN'],
  permissions: string[] = fullPermissions,
): AuthenticationResult {
  return {
    accessToken: 'memory-only-admin-dashboard-token',
    user: {
      id: '019f0000-0000-7000-8000-000000000401',
      email: 'admin@turktili.local',
      firstName: 'Bosh',
      lastName: 'Administrator',
      status: 'ACTIVE',
      lastLoginAt: null,
    },
    roles,
    permissions,
  };
}

function authContext(
  roles: RoleCode[] = ['ADMIN'],
  permissions: string[] = fullPermissions,
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
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        staleTime: Infinity,
      },
    },
  });
}

function renderDashboard(client: QueryClient, context: AuthContextValue = authContext()): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[adminDashboardPaths.dashboard]}>
          <AdminDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

function renderAuthorization(roles: RoleCode[], permissions: string[]): string {
  const client = queryClient();
  client.setQueryData(adminDashboardQueryKeys.summary(), summary);
  return renderToStaticMarkup(
    <AuthContext.Provider value={authContext(roles, permissions)}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[adminDashboardPaths.dashboard]}>
          <Routes>
            <Route element={<RequireAuthentication />}>
              <Route
                element={
                  <RequireAuthorization
                    permissions={[...adminDashboardRequiredPermissions]}
                    roles={['ADMIN']}
                  />
                }
              >
                <Route path={adminDashboardPaths.dashboard} element={<AdminDashboardPage />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(async () => authenticationResult()),
    refresh: vi.fn(async () => authenticationResult()),
    logout: vi.fn(async () => undefined),
    logoutAll: vi.fn(async () => undefined),
    ...overrides,
  };
}

const originalAdapter = apiClient.defaults.adapter;
let requests: InternalAxiosRequestConfig[] = [];

function mockAdapter(data: unknown): AxiosAdapter {
  return async (config) => {
    requests.push(config);
    return {
      config,
      data: { success: true, message: 'OK', data },
      headers: {},
      status: 200,
      statusText: 'OK',
    };
  };
}

function forbiddenError(): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
  return new AxiosError('forbidden', 'ERR_BAD_RESPONSE', config, undefined, {
    config,
    data: {},
    headers: {},
    status: 403,
    statusText: 'Forbidden',
  });
}

describe('Module 9.4C Admin Dashboard API and cache', () => {
  beforeEach(() => {
    requests = [];
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('uses exactly the approved aggregate endpoint once', async () => {
    apiClient.defaults.adapter = mockAdapter(summary);

    await expect(adminDashboardApi.getSummary()).resolves.toEqual(summary);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'get', url: '/admin/dashboard/summary' });
    expect(requests[0]?.params).toBeUndefined();
  });

  it('uses a stable hierarchical summary query key', () => {
    expect(adminDashboardQueryKeys.summary()).toEqual(['admin-dashboard', 'summary']);
    expect(adminDashboardQueryKeys.summary()).toEqual(adminDashboardQueryKeys.summary());
  });

  it('can retry the same query after a safe transport failure', async () => {
    const client = queryClient();
    let attempt = 0;
    const queryFn = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('network failure');
      return summary;
    });

    await expect(
      client.fetchQuery({ queryFn, queryKey: adminDashboardQueryKeys.summary(), retry: false }),
    ).rejects.toThrow('network failure');
    await expect(
      client.fetchQuery({ queryFn, queryKey: adminDashboardQueryKeys.summary(), retry: false }),
    ).resolves.toEqual(summary);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});

describe('Module 9.4C Admin Dashboard presentation', () => {
  it('renders an accessible initial loading state', () => {
    const markup = renderDashboard(queryClient());

    expect(markup).toContain('role="status"');
    expect(markup).toContain(adminDashboardMessages.loading);
    expect(markup).toContain('<h1');
  });

  it('renders every backend-authoritative summary section and count', () => {
    const client = queryClient();
    client.setQueryData(adminDashboardQueryKeys.summary(), summary);
    const markup = renderDashboard(client);

    expect(markup).toContain(adminDashboardMessages.sections.users);
    expect(markup).toContain(adminDashboardMessages.sections.courses);
    expect(markup).toContain(adminDashboardMessages.sections.enrollments);
    expect(markup).toContain(adminDashboardMessages.sections.progress);
    expect(markup).toContain(adminDashboardMessages.sections.certificates);
    for (const value of [120, 109, 102, 18, 10, 480, 350, 430, 72, 68]) {
      expect(markup).toContain(`>${value}<`);
    }
    expect(markup).toContain('64%');
  });

  it('renders all fixed user, course, enrollment and certificate labels', () => {
    const client = queryClient();
    client.setQueryData(adminDashboardQueryKeys.summary(), summary);
    const markup = renderDashboard(client);

    for (const label of [
      adminDashboardMessages.metrics.deactivated,
      adminDashboardMessages.metrics.students,
      adminDashboardMessages.metrics.teachers,
      adminDashboardMessages.metrics.administrators,
      adminDashboardMessages.metrics.draft,
      adminDashboardMessages.metrics.inReview,
      adminDashboardMessages.metrics.published,
      adminDashboardMessages.metrics.archived,
      adminDashboardMessages.metrics.completed,
      adminDashboardMessages.metrics.cancelled,
      adminDashboardMessages.metrics.trackedEnrollments,
      adminDashboardMessages.metrics.issued,
      adminDashboardMessages.metrics.revoked,
    ]) {
      expect(markup).toContain(label);
    }
  });

  it('renders zero-valued fixed sections as valid data', () => {
    const zeroSummary: AdminDashboardSummary = {
      generatedAt: summary.generatedAt,
      users: {
        total: 0,
        active: 0,
        suspended: 0,
        deactivated: 0,
        deleted: 0,
        students: 0,
        teachers: 0,
        administrators: 0,
      },
      courses: { total: 0, draft: 0, inReview: 0, published: 0, archived: 0, deleted: 0 },
      enrollments: { total: 0, active: 0, suspended: 0, completed: 0, cancelled: 0 },
      progress: { trackedEnrollments: 0, averageCompletionPercentage: 0 },
      certificates: { total: 0, issued: 0, revoked: 0 },
    };
    const client = queryClient();
    client.setQueryData(adminDashboardQueryKeys.summary(), zeroSummary);
    const markup = renderDashboard(client);

    expect(markup).toContain('>0<');
    expect(markup).toContain('0%');
    expect(markup).not.toContain('Natija topilmadi');
  });

  it('labels and localizes the server snapshot timestamp', () => {
    const client = queryClient();
    client.setQueryData(adminDashboardQueryKeys.summary(), summary);
    const markup = renderDashboard(client);

    expect(markup).toContain(adminDashboardMessages.snapshot.label);
    expect(markup).toContain(`dateTime="${summary.generatedAt}"`);
    expect(markup).toContain(formatAdminDashboardSnapshot(summary.generatedAt));
  });

  it('renders a safe retryable error without leaking transport details', async () => {
    const client = queryClient();
    await client.prefetchQuery({
      queryFn: async () => Promise.reject(new Error('C:\\private\\dashboard-query.sql')),
      queryKey: adminDashboardQueryKeys.summary(),
      retry: false,
    });
    const markup = renderDashboard(client);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain(adminDashboardMessages.error.retry);
    expect(markup).toContain(adminDashboardMessages.error.body);
    expect(markup).not.toContain('dashboard-query.sql');
    expect(markup).not.toContain('private');
  });

  it('maps a backend 403 to the existing permission-denied state', () => {
    const markup = renderToStaticMarkup(
      <AdminDashboardError error={forbiddenError()} onRetry={() => undefined} />,
    );

    expect(markup).toBe(renderToStaticMarkup(<PermissionDeniedState contained />));
  });

  it('keeps exactly one page-level heading when the API returns 403', async () => {
    const client = queryClient();
    await client.prefetchQuery({
      queryFn: async () => Promise.reject(forbiddenError()),
      queryKey: adminDashboardQueryKeys.summary(),
      retry: false,
    });

    const markup = renderDashboard(client);

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('Ruxsat mavjud emas');
    expect(markup).not.toContain(adminDashboardMessages.title);
  });

  it('uses semantic descriptions and responsive no-overflow classes', () => {
    const markup = renderToStaticMarkup(
      <AdminSummarySection
        headingId="large-values"
        metrics={[{ label: 'Juda uzun o‘zbekcha ko‘rsatkich nomi', value: 9_007_199_254_740_991 }]}
        title="Ko‘rsatkichlar"
      />,
    );

    expect(markup).toContain('<section');
    expect(markup).toContain('<h2');
    expect(markup).toContain('<dl');
    expect(markup).toContain('<dt');
    expect(markup).toContain('<dd');
    expect(markup).toContain('grid-cols-1');
    expect(markup).toContain('sm:grid-cols-2');
    expect(markup).toContain('xl:grid-cols-4');
    expect(markup).toContain('overflow-wrap-anywhere');
    expect(markup).toContain('break-all');
  });

  it('offers only the existing admin progress quick link', () => {
    const client = queryClient();
    client.setQueryData(adminDashboardQueryKeys.summary(), summary);
    const markup = renderDashboard(client);

    expect(markup).toContain('href="/admin/progress"');
    for (const deadPath of [
      '/admin/users',
      '/admin/courses',
      '/admin/enrollments',
      '/admin/certificates',
      '/admin/audit',
    ]) {
      expect(markup).not.toContain(`href="${deadPath}"`);
    }
  });
});

describe('Module 9.4C routing, authorization and session regressions', () => {
  it('registers /admin without removing the existing admin progress routes', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('adminDashboardPaths.dashboard');
    expect(appSource).toContain('progressReportingPaths.admin');
    expect(appSource).toContain('progressReportingPaths.adminEnrollmentPattern');
  });

  it('allows only a full administrator and uses /admin as its default destination', () => {
    const markup = renderAuthorization(['ADMIN'], fullPermissions);
    const session = authContext();

    expect(markup).toContain(adminDashboardMessages.title);
    if (session.status !== 'authenticated')
      throw new Error('Test sessiyasi autentifikatsiyalangan.');
    expect(defaultAuthenticatedPath(session)).toBe('/admin');
  });

  it.each([
    ['STUDENT', fullPermissions],
    ['TEACHER', fullPermissions],
  ] as const)('denies the %s role without rendering dashboard data', (role, permissions) => {
    const markup = renderAuthorization([role], [...permissions]);

    expect(markup).toContain('Ruxsat mavjud emas');
    expect(markup).not.toContain(adminDashboardMessages.sections.users);
  });

  it.each(adminDashboardRequiredPermissions)(
    'denies an administrator missing %s',
    (missingPermission) => {
      const permissions = fullPermissions.filter((permission) => permission !== missingPermission);
      const markup = renderAuthorization(['ADMIN'], permissions);

      expect(markup).toContain('Ruxsat mavjud emas');
      expect(markup).not.toContain(adminDashboardMessages.sections.users);
    },
  );

  it('waits for session restoration before a direct /admin refresh', async () => {
    const store = createAuthSessionStore();
    const controller = createAuthSessionController(fakeApi(), store);
    const client = queryClient();
    client.setQueryData(adminDashboardQueryKeys.summary(), summary);

    const render = () =>
      renderToStaticMarkup(
        <AuthContext.Provider
          value={{
            ...store.getSnapshot(),
            login: controller.login,
            logout: controller.logout,
            logoutAll: controller.logoutAll,
          }}
        >
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin']}>
              <Routes>
                <Route element={<RequireAuthentication />}>
                  <Route
                    element={
                      <RequireAuthorization
                        permissions={[...adminDashboardRequiredPermissions]}
                        roles={['ADMIN']}
                      />
                    }
                  >
                    <Route path="/admin" element={<AdminDashboardPage />} />
                  </Route>
                </Route>
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </AuthContext.Provider>,
      );

    expect(render()).not.toContain(adminDashboardMessages.sections.users);
    await controller.bootstrap();
    expect(render()).toContain(adminDashboardMessages.sections.users);
  });

  it('preserves logout behavior and clears the authenticated session', async () => {
    const store = createAuthSessionStore();
    store.establish(authenticationResult());
    const api = fakeApi();
    const controller = createAuthSessionController(api, store);

    await controller.logout();

    expect(api.logout).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toEqual(
      expect.objectContaining({ reason: 'SIGNED_OUT', status: 'unauthenticated' }),
    );
  });
});
