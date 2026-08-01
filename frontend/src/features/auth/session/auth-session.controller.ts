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

  const refreshAccessToken = (): Promise<string> => {
    if (refreshPromise) return refreshPromise;

    const operation = serialize(async () => {
      try {
        const result = await api.refresh();
        store.establish(result);
        return result.accessToken;
      } catch (error: unknown) {
        store.clear();
        throw error;
      }
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

  return {
    async bootstrap() {
      if (store.getSnapshot().status !== 'bootstrapping') return;

      await refreshAccessToken().catch(() => undefined);
    },

    async login(input) {
      await serialize(async () => {
        const result = await api.login(input);
        store.establish(result);
      });
    },

    async logout() {
      await serialize(async () => {
        try {
          await api.logout();
        } finally {
          store.clear();
        }
      });
    },

    async logoutAll() {
      await serialize(async () => {
        try {
          if (store.getAccessToken()) {
            await api.logoutAll();
          }
        } finally {
          store.clear();
        }
      });
    },

    refreshAccessToken,
  };
}
