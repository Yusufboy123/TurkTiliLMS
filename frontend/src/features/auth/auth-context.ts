import { createContext, useContext } from 'react';
import type { AuthSessionSnapshot, LoginInput } from './types/auth.types';

export type AuthContextValue = AuthSessionSnapshot & {
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth AuthProvider ichida ishlatilishi kerak.');
  }
  return context;
}
