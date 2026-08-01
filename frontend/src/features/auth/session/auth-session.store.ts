import type { AuthenticationResult, AuthSessionSnapshot } from '../types/auth.types';

export interface AuthSessionStore {
  clear(): void;
  establish(result: AuthenticationResult): void;
  getAccessToken(): string | null;
  getSnapshot(): AuthSessionSnapshot;
  subscribe(listener: () => void): () => void;
}

const bootstrappingSnapshot: AuthSessionSnapshot = {
  status: 'bootstrapping',
  user: null,
  roles: [],
  permissions: [],
};

const unauthenticatedSnapshot: AuthSessionSnapshot = {
  status: 'unauthenticated',
  user: null,
  roles: [],
  permissions: [],
};

export function didAuthenticatedIdentityChange(
  previous: AuthSessionSnapshot,
  current: AuthSessionSnapshot,
): boolean {
  if (previous.status !== 'authenticated') return false;
  if (current.status === 'unauthenticated') return true;
  return current.status === 'authenticated' && current.user.id !== previous.user.id;
}

export function createAuthSessionStore(): AuthSessionStore {
  let accessToken: string | null = null;
  let snapshot = bootstrappingSnapshot;
  const listeners = new Set<() => void>();

  const publish = (nextSnapshot: AuthSessionSnapshot) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };

  return {
    clear() {
      accessToken = null;
      publish(unauthenticatedSnapshot);
    },

    establish(result) {
      accessToken = result.accessToken;
      publish({
        status: 'authenticated',
        user: result.user,
        roles: [...result.roles],
        permissions: [...result.permissions],
      });
    },

    getAccessToken() {
      return accessToken;
    },

    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const authSessionStore = createAuthSessionStore();
