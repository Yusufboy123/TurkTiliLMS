import { useQuery } from '@tanstack/react-query';
import { adminActivityApi, type AdminActivityQuery } from './admin-activity.api';

export function useAdminActivity(query: AdminActivityQuery, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin-activity', query],
    queryFn: () => adminActivityApi.list(query),
  });
}
