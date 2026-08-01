import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { authApi } from '../src/features/auth/api/auth.api';
import { apiClient } from '../src/lib/api-client';

const originalAdapter = apiClient.defaults.adapter;
const session = {
  accessToken: 'access-token',
  user: {
    id: '019c0000-0000-7000-8000-000000000001',
    email: 'student@turktili.local',
    firstName: null,
    lastName: null,
    status: 'ACTIVE',
    lastLoginAt: null,
  },
  roles: ['STUDENT'],
  permissions: ['progress.self_read'],
};

describe('authentication API contract', () => {
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('uses the approved login, refresh, logout, and logout-all endpoints', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    const adapter: AxiosAdapter = async (config) => {
      requests.push(config);
      return {
        data:
          config.url === '/auth/login' || config.url === '/auth/refresh'
            ? { success: true, message: 'OK', data: session }
            : { success: true, message: 'OK' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await authApi.login({
      email: 'student@turktili.local',
      password: 'Student123!',
    });
    await authApi.refresh();
    await authApi.logout();
    await authApi.logoutAll();

    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'post /auth/login',
      'post /auth/refresh',
      'post /auth/logout',
      'post /auth/logout-all',
    ]);
    expect(requests[0].skipAuthHeader).toBe(true);
    expect(requests[0].skipAuthRefresh).toBe(true);
    expect(requests[1].skipAuthHeader).toBe(true);
    expect(requests[1].skipAuthRefresh).toBe(true);
    expect(requests.every((item) => item.withCredentials)).toBe(true);
    expect(requests.every((item) => item.headers.get('X-Auth-Transport') === 'cookie')).toBe(true);
    expect(requests[1].data).toBeUndefined();
  });

  it('rejects a malformed authentication response at the API boundary', async () => {
    apiClient.defaults.adapter = async (config) => ({
      data: {
        success: true,
        message: 'OK',
        data: { accessToken: 'token-without-required-session-fields' },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });

    await expect(
      authApi.login({
        email: 'student@turktili.local',
        password: 'Student123!',
      }),
    ).rejects.toThrow('Authentication API returned an invalid response.');
  });
});
