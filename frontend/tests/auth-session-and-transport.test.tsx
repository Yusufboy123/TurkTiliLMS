import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { RequireAuthentication } from '../src/features/auth/RequireAuthentication';
import { useAuth } from '../src/features/auth/auth-context';
import {
  createAuthSessionController,
  type AuthSessionController,
} from '../src/features/auth/session/auth-session.controller';
import {
  createAuthSessionStore,
  type AuthSessionStore,
} from '../src/features/auth/session/auth-session.store';
import type { AuthApi, AuthenticationResult } from '../src/features/auth/types/auth.types';
import { installAuthenticationInterceptors } from '../src/lib/api-client';

function sessionResult(
  accessToken = 'access-token-1',
  refreshToken = 'refresh-token-with-sufficient-length-1',
): AuthenticationResult {
  return {
    accessToken,
    refreshToken,
    user: {
      id: '019c0000-0000-7000-8000-000000000001',
      email: 'student@turktili.local',
      firstName: 'Ali',
      lastName: 'Valiyev',
      status: 'ACTIVE',
      lastLoginAt: '2026-07-27T08:00:00.000Z',
    },
    roles: ['STUDENT'],
    permissions: ['progress.self_read'],
  };
}

function createFakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(async () => sessionResult()),
    refresh: vi.fn(async () => sessionResult('access-token-2', 'refresh-token-2-long-enough')),
    logout: vi.fn(async () => undefined),
    logoutAll: vi.fn(async () => undefined),
    ...overrides,
  };
}

function successfulResponse(config: InternalAxiosRequestConfig, data: unknown = { ok: true }) {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function rejectUnauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    data: { success: false, code: 'INVALID_ACCESS_TOKEN', message: 'Unauthorized' },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  });
}

function installTestTransport(
  adapter: AxiosAdapter,
  store: AuthSessionStore,
  controller: AuthSessionController,
) {
  const client = axios.create({ adapter });
  const dispose = installAuthenticationInterceptors(client, {
    clearSession: store.clear,
    getAccessToken: store.getAccessToken,
    refreshAccessToken: controller.refreshAccessToken,
  });
  return { client, dispose };
}

describe('frontend authentication session ownership', () => {
  it('stores login credentials only in the in-memory session store', async () => {
    const store = createAuthSessionStore();
    const controller = createAuthSessionController(createFakeApi(), store);

    await controller.login({
      email: 'student@turktili.local',
      password: 'Student123!',
    });

    expect(store.getAccessToken()).toBe('access-token-1');
    expect(store.getRefreshToken()).toBe('refresh-token-with-sufficient-length-1');
    expect(store.getSnapshot().status).toBe('authenticated');
  });

  it('clears credentials and public session state after logout', async () => {
    const store = createAuthSessionStore();
    const api = createFakeApi();
    const controller = createAuthSessionController(api, store);
    store.establish(sessionResult());

    await controller.logout();

    expect(api.logout).toHaveBeenCalledOnce();
    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getSnapshot().status).toBe('unauthenticated');
  });

  it('treats a full reload without a recoverable refresh credential as unauthenticated', async () => {
    const previousRuntime = createAuthSessionStore();
    previousRuntime.establish(sessionResult());

    const reloadedRuntime = createAuthSessionStore();
    const api = createFakeApi();
    const controller = createAuthSessionController(api, reloadedRuntime);
    await controller.bootstrap();

    expect(api.refresh).not.toHaveBeenCalled();
    expect(reloadedRuntime.getSnapshot().status).toBe('unauthenticated');
    expect(reloadedRuntime.getAccessToken()).toBeNull();
  });

  it('never references localStorage or sessionStorage in authentication production code', () => {
    const authRoot = resolve(import.meta.dirname, '../src/features/auth');
    const sourceFiles = readdirSync(authRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
      .map((entry) => readFileSync(resolve(entry.parentPath, entry.name), 'utf8'));
    const apiClientSource = readFileSync(
      resolve(import.meta.dirname, '../src/lib/api-client.ts'),
      'utf8',
    );

    expect([...sourceFiles, apiClientSource].join('\n')).not.toMatch(
      /\b(?:localStorage|sessionStorage)\b/,
    );
  });
});

describe('authenticated Axios transport', () => {
  it('adds the current Bearer token to authenticated requests', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult());
    let authorization: string | undefined;
    const controller = createAuthSessionController(createFakeApi(), store);
    const { client, dispose } = installTestTransport(
      async (config) => {
        authorization = AxiosHeaders.from(config.headers).get('Authorization') ?? undefined;
        return successfulResponse(config);
      },
      store,
      controller,
    );

    await client.get('/protected');
    dispose();

    expect(authorization).toBe('Bearer access-token-1');
  });

  it('does not add an Authorization header when unauthenticated', async () => {
    const store = createAuthSessionStore();
    store.clear();
    let authorization: string | undefined;
    const controller = createAuthSessionController(createFakeApi(), store);
    const { client, dispose } = installTestTransport(
      async (config) => {
        authorization = AxiosHeaders.from(config.headers).get('Authorization') ?? undefined;
        return successfulResponse(config);
      },
      store,
      controller,
    );

    await client.get('/public');
    dispose();

    expect(authorization).toBeUndefined();
  });

  it('uses one refresh operation for concurrent 401 responses', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult('expired-access-token'));
    let releaseRefresh = () => undefined;
    const refreshGate = new Promise<void>((resolveGate) => {
      releaseRefresh = resolveGate;
    });
    const api = createFakeApi({
      refresh: vi.fn(async () => {
        await refreshGate;
        return sessionResult('rotated-access-token', 'rotated-refresh-token-long-enough');
      }),
    });
    const controller = createAuthSessionController(api, store);
    const { client, dispose } = installTestTransport(
      async (config) => {
        const token = AxiosHeaders.from(config.headers).get('Authorization');
        if (token === 'Bearer expired-access-token') rejectUnauthorized(config);
        return successfulResponse(config, { url: config.url });
      },
      store,
      controller,
    );

    const first = client.get('/first');
    const second = client.get('/second');
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 0));
    expect(api.refresh).toHaveBeenCalledOnce();
    releaseRefresh();
    await Promise.all([first, second]);
    dispose();
  });

  it('replays every queued request with the rotated access token', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult('expired-access-token'));
    const api = createFakeApi();
    const controller = createAuthSessionController(api, store);
    const replayed: string[] = [];
    const { client, dispose } = installTestTransport(
      async (config) => {
        const token = AxiosHeaders.from(config.headers).get('Authorization');
        if (token === 'Bearer expired-access-token') rejectUnauthorized(config);
        replayed.push(`${config.url}:${token}`);
        return successfulResponse(config);
      },
      store,
      controller,
    );

    await Promise.all([client.get('/first'), client.get('/second')]);
    dispose();

    expect(replayed).toEqual(['/first:Bearer access-token-2', '/second:Bearer access-token-2']);
  });

  it('rejects queued requests and clears the session when refresh fails', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult('expired-access-token'));
    const api = createFakeApi({
      refresh: vi.fn(async () => Promise.reject(new Error('refresh failed'))),
    });
    const controller = createAuthSessionController(api, store);
    const { client, dispose } = installTestTransport(
      async (config) => rejectUnauthorized(config),
      store,
      controller,
    );

    const results = await Promise.allSettled([client.get('/first'), client.get('/second')]);
    dispose();

    expect(api.refresh).toHaveBeenCalledOnce();
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getSnapshot().status).toBe('unauthenticated');
  });
});

describe('AuthProvider and protected route lifecycle', () => {
  function SessionProbe() {
    const auth = useAuth();
    return <p>{auth.status}</p>;
  }

  it('exposes explicit bootstrapping and authenticated provider states', () => {
    const store = createAuthSessionStore();
    const controller = createAuthSessionController(createFakeApi(), store);

    const bootstrapping = renderToStaticMarkup(
      <AuthProvider controller={controller} store={store}>
        <SessionProbe />
      </AuthProvider>,
    );
    store.establish(sessionResult());
    const authenticated = renderToStaticMarkup(
      <AuthProvider controller={controller} store={store}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(bootstrapping).toContain('bootstrapping');
    expect(authenticated).toContain('authenticated');
  });

  it('allows protected route content only for an authenticated session', () => {
    const authenticatedStore = createAuthSessionStore();
    authenticatedStore.establish(sessionResult());
    const authenticatedController = createAuthSessionController(
      createFakeApi(),
      authenticatedStore,
    );

    const authenticatedMarkup = renderToStaticMarkup(
      <AuthProvider controller={authenticatedController} store={authenticatedStore}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<RequireAuthentication />}>
              <Route path="/protected" element={<p>Protected content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    const unauthenticatedStore = createAuthSessionStore();
    unauthenticatedStore.clear();
    const unauthenticatedController = createAuthSessionController(
      createFakeApi(),
      unauthenticatedStore,
    );
    const unauthenticatedMarkup = renderToStaticMarkup(
      <AuthProvider controller={unauthenticatedController} store={unauthenticatedStore}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/" element={<p>Public content</p>} />
            <Route element={<RequireAuthentication />}>
              <Route path="/protected" element={<p>Protected content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(authenticatedMarkup).toContain('Protected content');
    expect(unauthenticatedMarkup).not.toContain('Protected content');
  });
});
