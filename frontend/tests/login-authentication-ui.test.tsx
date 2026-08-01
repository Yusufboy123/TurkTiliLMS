import { createRef, type ComponentProps } from 'react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ErrorSummary } from '../src/components';
import {
  defaultAuthenticatedPath,
  resolveAuthenticatedDestination,
} from '../src/features/auth/auth.routes';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { RequireAuthentication } from '../src/features/auth/RequireAuthentication';
import { RequireGuest } from '../src/features/auth/RequireGuest';
import { LoginFormView } from '../src/features/auth/login/LoginFormView';
import {
  mapLoginFailure,
  normalizeLoginEmail,
  validateLoginForm,
} from '../src/features/auth/login/login-form.model';
import {
  createAuthSessionController,
  type AuthSessionController,
} from '../src/features/auth/session/auth-session.controller';
import {
  createAuthSessionStore,
  type AuthSessionStore,
} from '../src/features/auth/session/auth-session.store';
import type {
  AuthApi,
  AuthenticatedSession,
  AuthenticationResult,
} from '../src/features/auth/types/auth.types';
import { authMessages } from '../src/locales/uz-Latn/auth';
import LoginPage from '../src/features/auth/pages/LoginPage';
import TeacherHomePage from '../src/features/auth/pages/TeacherHomePage';

type MemoryRouterEntry = NonNullable<ComponentProps<typeof MemoryRouter>['initialEntries']>[number];

function sessionResult(
  roles: AuthenticationResult['roles'] = ['STUDENT'],
  permissions: string[] = ['progress.self_read'],
): AuthenticationResult {
  return {
    accessToken: 'memory-only-access-token',
    user: {
      id: '019c0000-0000-7000-8000-000000000091',
      email: 'student@turktili.local',
      firstName: 'Ali',
      lastName: 'Valiyev',
      status: 'ACTIVE',
      lastLoginAt: null,
    },
    roles,
    permissions,
  };
}

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(async () => sessionResult()),
    refresh: vi.fn(async () => sessionResult()),
    logout: vi.fn(async () => undefined),
    logoutAll: vi.fn(async () => undefined),
    ...overrides,
  };
}

function authenticatedSession(
  roles: AuthenticatedSession['roles'],
  permissions: string[],
): AuthenticatedSession {
  const result = sessionResult(roles, permissions);
  return {
    status: 'authenticated',
    reason: null,
    user: result.user,
    roles: result.roles,
    permissions: result.permissions,
  };
}

function apiError(status: number, code: string): AxiosError<{ code: string }> {
  const config: InternalAxiosRequestConfig = {
    headers: new AxiosHeaders(),
  };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
    config,
    data: { code },
    headers: {},
    status,
    statusText: 'Request failed',
  });
}

function renderLoginForm(overrides: Partial<Parameters<typeof LoginFormView>[0]> = {}): string {
  return renderToStaticMarkup(
    <LoginFormView
      capsLockEnabled={false}
      errors={{}}
      onCapsLockChange={() => undefined}
      onChange={() => undefined}
      onPasswordVisibilityChange={() => undefined}
      onSubmit={() => undefined}
      passwordVisible={false}
      pending={false}
      submissionFailure={null}
      summaryRef={createRef<HTMLDivElement>()}
      values={{ email: '', password: '' }}
      {...overrides}
    />,
  );
}

function renderRoute(
  store: AuthSessionStore,
  controller: AuthSessionController,
  initialEntry: MemoryRouterEntry,
  routes: React.ReactNode,
): string {
  return renderToStaticMarkup(
    <AuthProvider controller={controller} store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('login form validation and states', () => {
  it('validates required and malformed credentials before submission', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: authMessages.validation.emailRequired,
      password: authMessages.validation.passwordRequired,
    });
    expect(validateLoginForm({ email: 'noto‘g‘ri', password: 'secret' }).email).toBe(
      authMessages.validation.emailInvalid,
    );
    expect(validateLoginForm({ email: 'USER@Example.COM ', password: 'secret' })).toEqual({});
    expect(normalizeLoginEmail(' USER@Example.COM ')).toBe('user@example.com');
  });

  it('renders accessible labels, autocomplete and password visibility control', () => {
    const markup = renderLoginForm();

    expect(markup).toContain('for="login-email"');
    expect(markup).toContain('autoComplete="email"');
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain(authMessages.login.showPassword);
  });

  it('renders loading without allowing another submission', () => {
    const markup = renderLoginForm({ pending: true });

    expect(markup).toContain('aria-busy="true"');
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('links field validation messages to their controls', () => {
    const markup = renderLoginForm({
      errors: {
        email: authMessages.validation.emailInvalid,
        password: authMessages.validation.passwordRequired,
      },
    });

    expect(markup).toContain('href="#login-email"');
    expect(markup).toContain('href="#login-password"');
    expect(markup).toContain('aria-invalid="true"');
  });

  it('uses the reusable focusable error summary', () => {
    const markup = renderToStaticMarkup(
      <ErrorSummary
        items={[{ message: 'Email xatosi', targetId: 'login-email' }]}
        title="Xatolar"
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('tabindex="-1"');
  });
});

describe('login failures', () => {
  it('keeps inactive-account handling non-enumerating', () => {
    const failure = mapLoginFailure(apiError(401, 'INVALID_CREDENTIALS'));

    expect(failure.message).toBe(authMessages.errors.invalidCredentials);
    expect(failure.help).toBe(authMessages.errors.inactiveAccountHelp);
    expect(failure.clearPassword).toBe(true);
  });

  it('maps server validation and rate limiting to stable Uzbek messages', () => {
    expect(mapLoginFailure(apiError(422, 'VALIDATION_ERROR')).message).toBe(
      authMessages.errors.validation,
    );
    expect(mapLoginFailure(apiError(429, 'AUTH_RATE_LIMITED')).message).toBe(
      authMessages.errors.rateLimited,
    );
  });

  it('maps network and server failures without exposing implementation details', () => {
    const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
    const networkFailure = new AxiosError('socket secret', 'ERR_NETWORK', config);

    expect(mapLoginFailure(networkFailure).message).toBe(authMessages.errors.network);
    expect(mapLoginFailure(apiError(503, 'INTERNAL_SERVER_ERROR')).message).toBe(
      authMessages.errors.server,
    );
  });
});

describe('authentication routing and session lifecycle', () => {
  it('chooses the approved home path for each role', () => {
    expect(
      defaultAuthenticatedPath(authenticatedSession(['STUDENT'], ['progress.self_read'])),
    ).toBe('/app');
    expect(defaultAuthenticatedPath(authenticatedSession(['TEACHER'], []))).toBe('/teacher');
    expect(defaultAuthenticatedPath(authenticatedSession(['ADMIN'], ['progress.read']))).toBe(
      '/admin/progress',
    );
  });

  it('returns only to safe routes authorized for the authenticated role', () => {
    const student = authenticatedSession(['STUDENT'], ['progress.self_read']);
    const teacher = authenticatedSession(['TEACHER'], ['progress.course.read']);

    expect(resolveAuthenticatedDestination(student, '/app/progress?course=1')).toBe(
      '/app/progress?course=1',
    );
    expect(resolveAuthenticatedDestination(student, '//evil.example')).toBe('/app');
    expect(resolveAuthenticatedDestination(student, '/admin/progress')).toBe('/app');
    expect(resolveAuthenticatedDestination(teacher, '/teacher/courses/course-1/progress')).toBe(
      '/teacher/courses/course-1/progress',
    );
  });

  it('restores a browser session before showing protected content', async () => {
    const store = createAuthSessionStore();
    const api = fakeApi();
    const controller = createAuthSessionController(api, store);

    const bootstrapping = renderRoute(
      store,
      controller,
      '/protected',
      <Route element={<RequireAuthentication />}>
        <Route path="/protected" element={<p>Himoyalangan sahifa</p>} />
      </Route>,
    );
    expect(bootstrapping).toContain(authMessages.bootstrapping);
    expect(bootstrapping).not.toContain('Himoyalangan sahifa');

    await controller.bootstrap();
    const restored = renderRoute(
      store,
      controller,
      '/protected',
      <Route element={<RequireAuthentication />}>
        <Route path="/protected" element={<p>Himoyalangan sahifa</p>} />
      </Route>,
    );
    expect(restored).toContain('Himoyalangan sahifa');
  });

  it('allows the login guest route only while unauthenticated', () => {
    const store = createAuthSessionStore();
    store.clear();
    const controller = createAuthSessionController(fakeApi(), store);
    const markup = renderRoute(
      store,
      controller,
      { pathname: '/login', state: { reason: 'SESSION_EXPIRED' } },
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<p>Login formasi</p>} />
      </Route>,
    );

    expect(markup).toContain('Login formasi');
  });

  it('explains an expired session on the login page without flashing protected content', () => {
    const store = createAuthSessionStore();
    store.clear('SESSION_EXPIRED');
    const controller = createAuthSessionController(fakeApi(), store);
    const markup = renderRoute(
      store,
      controller,
      { pathname: '/login', state: { reason: 'SESSION_EXPIRED' } },
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>,
    );

    expect(markup).toContain(authMessages.session.expired);
    expect(markup).toContain(authMessages.login.title);
  });

  it('does not repeat a stale signed-out notice on a later direct login visit', () => {
    const store = createAuthSessionStore();
    store.clear('SIGNED_OUT');
    const controller = createAuthSessionController(fakeApi(), store);
    const markup = renderRoute(
      store,
      controller,
      '/login',
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>,
    );

    expect(markup).not.toContain(authMessages.session.signedOut);
  });

  it('keeps the teacher destination an explicitly limited localized landing page', () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult(['TEACHER'], []));
    const controller = createAuthSessionController(fakeApi(), store);
    const markup = renderRoute(
      store,
      controller,
      '/teacher',
      <Route path="/teacher" element={<TeacherHomePage />} />,
    );

    expect(markup).toContain(authMessages.teacherHome.title);
    expect(markup).toContain(authMessages.teacherHome.description);
  });

  it('establishes a session after successful login and clears it on logout-all', async () => {
    const store = createAuthSessionStore();
    const api = fakeApi();
    const controller = createAuthSessionController(api, store);

    await controller.login({ email: 'student@turktili.local', password: 'Student123!' });
    expect(store.getSnapshot().status).toBe('authenticated');

    await controller.logoutAll();
    expect(api.logoutAll).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'unauthenticated', reason: 'SIGNED_OUT' }),
    );
  });

  it('marks an expired authenticated session after refresh failure', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult());
    const controller = createAuthSessionController(
      fakeApi({ refresh: vi.fn(async () => Promise.reject(new Error('expired'))) }),
      store,
    );

    await expect(controller.refreshAccessToken()).rejects.toThrow('expired');
    expect(store.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'unauthenticated', reason: 'SESSION_EXPIRED' }),
    );
  });
});
