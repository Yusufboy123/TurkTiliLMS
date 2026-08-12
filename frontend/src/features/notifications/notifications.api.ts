import { apiClient } from '../../lib/api-client';
import type { SuccessEnvelope } from '../progress';
import type { NotificationAudience, NotificationPage } from './notifications.types';

export const notificationsApi = {
  async list(): Promise<NotificationPage> {
    const response = await apiClient.get<SuccessEnvelope<NotificationPage>>('/me/notifications', { params: { page: 1, pageSize: 20 } });
    return response.data.data;
  },
  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/me/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await apiClient.post('/me/notifications/read-all');
  },
  async announce(input: { audience: NotificationAudience; title: string; message: string; targetUrl?: string }): Promise<number> {
    const response = await apiClient.post<SuccessEnvelope<{ count: number }>>('/admin/announcements', input);
    return response.data.data.count;
  },
};
