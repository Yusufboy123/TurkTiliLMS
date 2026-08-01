import { apiClient } from '../../../lib/api-client';
import type { AuthApi, AuthenticationResult, AuthUser, RoleCode } from '../types/auth.types';

const roleCodes = new Set<RoleCode>(['ADMIN', 'TEACHER', 'STUDENT']);
const userStatuses = new Set<AuthUser['status']>(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETED']);
const browserTransportConfiguration = {
  headers: { 'X-Auth-Transport': 'cookie' },
  skipAuthHeader: true,
  skipAuthRefresh: true,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function parseAuthenticationResult(envelope: unknown): AuthenticationResult {
  if (!isRecord(envelope) || envelope.success !== true || typeof envelope.message !== 'string') {
    throw new Error('Authentication API returned an invalid response.');
  }

  const data = envelope.data;
  if (!isRecord(data) || !isRecord(data.user)) {
    throw new Error('Authentication API returned an invalid response.');
  }

  const user = data.user;
  const roles = data.roles;
  const permissions = data.permissions;
  const valid =
    typeof data.accessToken === 'string' &&
    data.accessToken.length > 0 &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    isNullableString(user.firstName) &&
    isNullableString(user.lastName) &&
    typeof user.status === 'string' &&
    userStatuses.has(user.status as AuthUser['status']) &&
    isNullableString(user.lastLoginAt) &&
    Array.isArray(roles) &&
    roles.every((role) => typeof role === 'string' && roleCodes.has(role as RoleCode)) &&
    Array.isArray(permissions) &&
    permissions.every((permission) => typeof permission === 'string');

  if (!valid) {
    throw new Error('Authentication API returned an invalid response.');
  }

  return {
    accessToken: data.accessToken as string,
    user: {
      id: user.id as string,
      email: user.email as string,
      firstName: user.firstName as string | null,
      lastName: user.lastName as string | null,
      status: user.status as AuthUser['status'],
      lastLoginAt: user.lastLoginAt as string | null,
    },
    roles: roles as RoleCode[],
    permissions: permissions as string[],
  };
}

export const authApi: AuthApi = {
  async login(input) {
    const response = await apiClient.post<unknown>(
      '/auth/login',
      {
        ...input,
        clientType: input.clientType ?? 'WEB',
      },
      {
        ...browserTransportConfiguration,
      },
    );
    return parseAuthenticationResult(response.data);
  },

  async refresh() {
    const response = await apiClient.post<unknown>(
      '/auth/refresh',
      undefined,
      browserTransportConfiguration,
    );
    return parseAuthenticationResult(response.data);
  },

  async logout() {
    await apiClient.post('/auth/logout', undefined, {
      headers: browserTransportConfiguration.headers,
      skipAuthRefresh: true,
    });
  },

  async logoutAll() {
    await apiClient.post('/auth/logout-all', undefined, {
      headers: browserTransportConfiguration.headers,
      skipAuthRefresh: true,
    });
  },
};
