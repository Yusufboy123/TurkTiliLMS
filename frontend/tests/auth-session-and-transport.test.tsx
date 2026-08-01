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
  didAuthenticatedIdentityChange,
  type AuthSessionStore,
} from '../src/features/auth/session/auth-session.store';
import type { AuthApi, AuthenticationResult } from '../src/features/auth/types/auth.types';
import { installAuthenticationInterceptors } from '../src/lib/api-client';

function sessionResult(
  accessToken = 'access-token-1',
  userId = '019c0000-0000-7000-8000-000000000001',
): AuthenticationResult {
  return {
    accessToken,
    user: {
      id: userId,
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
    refresh: vi.fn(async () => sessionResult('access-token-2')),
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

function rejectForbidden(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, {
    data: { success: false, code: 'FORBIDDEN', message: 'Forbidden' },
    status: 403,
    statusText: 'Forbidden',
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
  it('stores only the access token in the in-memory session store', async () => {
    const store = createAuthSessionStore();
    const controller = createAuthSessionController(createFakeApi(), store);

    await controller.login({
      email: 'student@turktili.local',
      password: 'Student123!',
    });

    expect(store.getAccessToken()).toBe('access-token-1');
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
    expect(store.getSnapshot().status).toBe('unauthenticated');
    expect(store.getSnapshot()).toEqual(expect.objectContaining({ reason: 'SIGNED_OUT' }));
  });

  it('restores a full reload through the cookie-backed refresh API', async () => {
    const previousRuntime = createAuthSessionStore();
    previousRuntime.establish(sessionResult());

    const reloadedRuntime = createAuthSessionStore();
    const api = createFakeApi();
    const controller = createAuthSessionController(api, reloadedRuntime);
    await controller.bootstrap();

    expect(api.refresh).toHaveBeenCalledOnce();
    expect(reloadedRuntime.getSnapshot().status).toBe('authenticated');
    expect(reloadedRuntime.getAccessToken()).toBe('access-token-2');
  });

  it('settles as unauthenticated when cookie-backed bootstrap refresh fails', async () => {
    const store = createAuthSessionStore();
    const api = createFakeApi({
      refresh: vi.fn(async () => Promise.reject(new Error('no browser session'))),
    });
    const controller = createAuthSessionController(api, store);

    await controller.bootstrap();

    expect(api.refresh).toHaveBeenCalledOnce();
    expect(store.getSnapshot().status).toBe('unauthenticated');
    expect(store.getSnapshot()).toEqual(expect.objectContaining({ reason: null }));
    expect(store.getAccessToken()).toBeNull();
  });

  it('clears local session state even when browser logout fails', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult());
    const controller = createAuthSessionController(
      createFakeApi({
        logout: vi.fn(async () => Promise.reject(new Error('network unavailable'))),
      }),
      store,
    );

    await expect(controller.logout()).rejects.toThrow('network unavailable');
    expect(store.getSnapshot().status).toBe('unauthenticated');
    expect(store.getAccessToken()).toBeNull();
  });

  it('clears local session state even when logout-all fails', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult());
    const controller = createAuthSessionController(
      createFakeApi({
        logoutAll: vi.fn(async () => Promise.reject(new Error('network unavailable'))),
      }),
      store,
    );

    await expect(controller.logoutAll()).rejects.toThrow('network unavailable');
    expect(store.getSnapshot().status).toBe('unauthenticated');
    expect(store.getAccessToken()).toBeNull();
  });

  it('serializes refresh before login so a stale refresh cannot overwrite a user switch', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult('expired-user-a-token'));
    let releaseRefresh = () => undefined;
    const refreshGate = new Promise<void>((resolveGate) => {
      releaseRefresh = resolveGate;
    });
    const api = createFakeApi({
      refresh: vi.fn(async () => {
        await refreshGate;
        return sessionResult('rotated-user-a-token');
      }),
      login: vi.fn(async () =>
        sessionResult('user-b-token', '019c0000-0000-7000-8000-000000000002'),
      ),
    });
    const controller = createAuthSessionController(api, store);

    const refresh = controller.refreshAccessToken();
    const login = controller.login({ email: 'user-b@example.com', password: 'ValidPassword1!' });
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 0));
    expect(api.login).not.toHaveBeenCalled();

    releaseRefresh();
    await Promise.all([refresh, login]);

    expect(store.getAccessToken()).toBe('user-b-token');
    expect(store.getSnapshot()).toEqual(
      expect.objectContaining({
        status: 'authenticated',
        user: expect.objectContaining({ id: '019c0000-0000-7000-8000-000000000002' }),
      }),
    );
  });

  it('serializes logout after an in-flight refresh and always leaves local state cleared', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult('expired-access-token'));
    let releaseRefresh = () => undefined;
    const refreshGate = new Promise<void>((resolveGate) => {
      releaseRefresh = resolveGate;
    });
    const api = createFakeApi({
      refresh: vi.fn(async () => {
        await refreshGate;
        return sessionResult('rotated-access-token');
      }),
    });
    const controller = createAuthSessionController(api, store);

    const refresh = controller.refreshAccessToken();
    const logout = controller.logout();
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 0));
    expect(api.logout).not.toHaveBeenCalled();

    releaseRefresh();
    await Promise.all([refresh, logout]);

    expect(api.logout).toHaveBeenCalledOnce();
    expect(store.getAccessToken()).toBeNull();
    expect(store.getSnapshot().status).toBe('unauthenticated');
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
  it('enables credentialed browser requests on the shared API client', async () => {
    const store = createAuthSessionStore();
    let withCredentials: boolean | undefined;
    const controller = createAuthSessionController(createFakeApi(), store);
    const { client, dispose } = installTestTransport(
      async (config) => {
        withCredentials = config.withCredentials;
        return successfulResponse(config);
      },
      store,
      controller,
    );
    client.defaults.withCredentials = true;

    await client.get('/public');
    dispose();

    expect(withCredentials).toBe(true);
  });

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
        return sessionResult('rotated-access-token');
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
    expect(store.getSnapshot().status).toBe('unauthenticated');
    expect(store.getSnapshot()).toEqual(expect.objectContaining({ reason: 'SESSION_EXPIRED' }));
  });

  it('preserves the authenticated session and does not refresh on a 403 response', async () => {
    const store = createAuthSessionStore();
    store.establish(sessionResult());
    const api = createFakeApi();
    const controller = createAuthSessionController(api, store);
    const { client, dispose } = installTestTransport(
      async (config) => rejectForbidden(config),
      store,
      controller,
    );

    await expect(client.get('/forbidden')).rejects.toMatchObject({ response: { status: 403 } });
    dispose();

    expect(api.refresh).not.toHaveBeenCalled();
    expect(store.getSnapshot().status).toBe('authenticated');
    expect(store.getAccessToken()).toBe('access-token-1');
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

  it('detects authenticated user replacement so protected query state is cleared', () => {
    const firstStore = createAuthSessionStore();
    firstStore.establish(sessionResult('user-a-token'));
    const secondStore = createAuthSessionStore();
    secondStore.establish(sessionResult('user-b-token', '019c0000-0000-7000-8000-000000000002'));

    expect(
      didAuthenticatedIdentityChange(firstStore.getSnapshot(), secondStore.getSnapshot()),
    ).toBe(true);
    expect(didAuthenticatedIdentityChange(firstStore.getSnapshot(), firstStore.getSnapshot())).toBe(
      false,
    );
  });
});
