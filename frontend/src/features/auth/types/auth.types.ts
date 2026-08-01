export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';
export type RoleCode = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'DELETED';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
}

export interface AuthenticationResult {
  accessToken: string;
  user: AuthUser;
  roles: RoleCode[];
  permissions: string[];
}

export interface LoginInput {
  email: string;
  password: string;
  clientType?: 'WEB';
  deviceName?: string;
}

export interface AuthenticatedSession {
  status: 'authenticated';
  user: AuthUser;
  roles: RoleCode[];
  permissions: string[];
}

export interface EmptySession {
  status: 'bootstrapping' | 'unauthenticated';
  user: null;
  roles: [];
  permissions: [];
}

export type AuthSessionSnapshot = AuthenticatedSession | EmptySession;

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface AuthApi {
  login(input: LoginInput): Promise<AuthenticationResult>;
  refresh(): Promise<AuthenticationResult>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
}
