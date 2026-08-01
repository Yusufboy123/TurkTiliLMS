export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';
export type AuthEndReason = 'SESSION_EXPIRED' | 'SIGNED_OUT';
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
  reason: null;
  user: AuthUser;
  roles: RoleCode[];
  permissions: string[];
}

export interface BootstrappingSession {
  status: 'bootstrapping';
  reason: null;
  user: null;
  roles: [];
  permissions: [];
}

export interface UnauthenticatedSession {
  status: 'unauthenticated';
  reason: AuthEndReason | null;
  user: null;
  roles: [];
  permissions: [];
}

export type AuthSessionSnapshot =
  AuthenticatedSession | BootstrappingSession | UnauthenticatedSession;

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
