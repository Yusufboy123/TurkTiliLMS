import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { notificationsApi } from '../src/features/notifications/notifications.api';
import { apiClient } from '../src/lib/api-client';

const originalAdapter = apiClient.defaults.adapter;
let requests: InternalAxiosRequestConfig[] = [];

describe('notifications API client', () => {
  beforeEach(() => { requests = []; apiClient.defaults.adapter = (async (config) => { requests.push(config); return { data: { success: true, message: 'OK', data: { items: [], unreadCount: 0, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, count: 0 } }, status: 200, statusText: 'OK', headers: {}, config }; }) as AxiosAdapter; });
  afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

  it('uses owner-scoped notification endpoints and safe announcement payloads', async () => {
    await notificationsApi.list();
    await notificationsApi.markRead('notification-1');
    await notificationsApi.markAllRead();
    await notificationsApi.announce({ audience: 'STUDENT', title: 'Yangilik', message: 'Xabar', targetUrl: '/app/courses' });
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'get /me/notifications',
      'patch /me/notifications/notification-1/read',
      'post /me/notifications/read-all',
      'post /admin/announcements',
    ]);
    expect(JSON.parse(String(requests[3]?.data))).toMatchObject({ audience: 'STUDENT', targetUrl: '/app/courses' });
  });
});
