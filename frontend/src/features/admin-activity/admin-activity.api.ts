import { apiClient } from '../../lib/api-client';
import type { SuccessEnvelope } from '../progress';
import type { AdminActivityPage } from './admin-activity.types';

export interface AdminActivityQuery {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
}

export const adminActivityApi = {
  async list(query: AdminActivityQuery): Promise<AdminActivityPage> {
    const response = await apiClient.get<SuccessEnvelope<AdminActivityPage>>('/admin/activity', { params: query });
    return response.data.data;
  },
};
