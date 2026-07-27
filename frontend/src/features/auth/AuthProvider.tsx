import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';
import type { AuthSessionController } from './session/auth-session.controller';
import { authSessionController } from './session/auth-session.runtime';
import { authSessionStore, type AuthSessionStore } from './session/auth-session.store';
import type { LoginInput } from './types/auth.types';

export interface AuthProviderProps {
  children: ReactNode;
  controller?: AuthSessionController;
  onSessionCleared?: () => void;
  store?: AuthSessionStore;
}

export function AuthProvider({
  children,
  controller = authSessionController,
  onSessionCleared,
  store = authSessionStore,
}: AuthProviderProps) {
  const session = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const previousStatus = useRef(session.status);

  useEffect(() => {
    void controller.bootstrap().catch(() => undefined);
  }, [controller]);

  useEffect(() => {
    if (previousStatus.current === 'authenticated' && session.status === 'unauthenticated') {
      onSessionCleared?.();
    }
    previousStatus.current = session.status;
  }, [onSessionCleared, session.status]);

  const login = useCallback((input: LoginInput) => controller.login(input), [controller]);
  const logout = useCallback(() => controller.logout(), [controller]);
  const logoutAll = useCallback(() => controller.logoutAll(), [controller]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      login,
      logout,
      logoutAll,
    }),
    [login, logout, logoutAll, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
