import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './notifications.api';

export function useNotifications(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list, enabled, refetchInterval: 60_000 });
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => { void client.invalidateQueries({ queryKey: ['notifications'] }); } });
  const markAllRead = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => { void client.invalidateQueries({ queryKey: ['notifications'] }); } });
  return { query, markRead, markAllRead };
}

export function useCreateAnnouncement() {
  const client = useQueryClient();
  return useMutation({ mutationFn: notificationsApi.announce, onSuccess: () => { void client.invalidateQueries({ queryKey: ['notifications'] }); } });
}
