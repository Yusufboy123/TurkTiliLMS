import { useQuery } from '@tanstack/react-query';
import { adminDashboardApi } from '../api/admin-dashboard.api';
import { adminDashboardQueryKeys } from './admin-dashboard-query-keys';

export function useAdminDashboardSummary(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: adminDashboardApi.getSummary,
    queryKey: adminDashboardQueryKeys.summary(),
  });
}
