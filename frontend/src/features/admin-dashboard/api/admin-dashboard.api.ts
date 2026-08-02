import { apiClient } from '../../../lib/api-client';
import type { SuccessEnvelope } from '../../progress';
import type { AdminDashboardSummary } from '../types/admin-dashboard.types';

export const adminDashboardApi = {
  async getSummary(): Promise<AdminDashboardSummary> {
    const response = await apiClient.get<SuccessEnvelope<AdminDashboardSummary>>(
      '/admin/dashboard/summary',
    );
    return response.data.data;
  },
};
