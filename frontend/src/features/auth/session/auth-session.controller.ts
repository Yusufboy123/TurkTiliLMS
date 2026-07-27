import type { AuthApi, LoginInput } from '../types/auth.types';
import type { AuthSessionStore } from './auth-session.store';

export interface AuthSessionController {
  bootstrap(): Promise<void>;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  refreshAccessToken(): Promise<string>;
}

export class MissingRefreshCredentialError extends Error {
  constructor() {
    super('No in-memory refresh credential is available.');
    this.name = 'MissingRefreshCredentialError';
  }
}

export function createAuthSessionController(
  api: AuthApi,
  store: AuthSessionStore,
): AuthSessionController {
  let refreshPromise: Promise<string> | null = null;

  const refreshAccessToken = (): Promise<string> => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = store.getRefreshToken();
    if (!refreshToken) {
      store.clear();
      return Promise.reject(new MissingRefreshCredentialError());
    }

    refreshPromise = api
      .refresh(refreshToken)
      .then((result) => {
        store.establish(result);
        return result.accessToken;
      })
      .catch((error: unknown) => {
        store.clear();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  };

  return {
    async bootstrap() {
      if (store.getSnapshot().status !== 'bootstrapping') return;

      // The current backend returns refresh credentials in JSON rather than an
      // HttpOnly cookie. Nothing can be safely recovered after a full reload.
      store.clear();
    },

    async login(input) {
      const result = await api.login(input);
      store.establish(result);
    },

    async logout() {
      try {
        if (store.getAccessToken()) {
          await api.logout();
        }
      } finally {
        store.clear();
      }
    },

    async logoutAll() {
      try {
        if (store.getAccessToken()) {
          await api.logoutAll();
        }
      } finally {
        store.clear();
      }
    },

    refreshAccessToken,
  };
}
