import type { AuthApi, LoginInput } from '../types/auth.types';
import type { AuthSessionStore } from './auth-session.store';

export interface AuthSessionController {
  bootstrap(): Promise<void>;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  refreshAccessToken(): Promise<string>;
}

export function createAuthSessionController(
  api: AuthApi,
  store: AuthSessionStore,
): AuthSessionController {
  let refreshPromise: Promise<string> | null = null;
  let operationTail: Promise<void> = Promise.resolve();

  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const requestRefresh = (): Promise<string> => {
    if (refreshPromise) return refreshPromise;

    const operation = serialize(async () => {
      const result = await api.refresh();
      store.establish(result);
      return result.accessToken;
    });
    refreshPromise = operation;
    void operation.then(
      () => {
        if (refreshPromise === operation) refreshPromise = null;
      },
      () => {
        if (refreshPromise === operation) refreshPromise = null;
      },
    );

    return operation;
  };

  const refreshAccessToken = async (): Promise<string> => {
    try {
      return await requestRefresh();
    } catch (error: unknown) {
      store.clear('SESSION_EXPIRED');
      throw error;
    }
  };

  return {
    async bootstrap() {
      if (store.getSnapshot().status !== 'bootstrapping') return;

      await requestRefresh().catch(() => store.clear());
    },

    async login(input) {
      await serialize(async () => {
        const result = await api.login(input);
        store.establish(result);
      });
    },

    async logout() {
      await serialize(async () => {
        let completed = false;
        try {
          await api.logout();
          completed = true;
        } finally {
          store.clear(completed ? 'SIGNED_OUT' : null);
        }
      });
    },

    async logoutAll() {
      await serialize(async () => {
        let completed = false;
        try {
          if (store.getAccessToken()) {
            await api.logoutAll();
          }
          completed = true;
        } finally {
          store.clear(completed ? 'SIGNED_OUT' : null);
        }
      });
    },

    refreshAccessToken,
  };
}
