import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './api';

const KEY = ['notifications'] as const;

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: [...KEY, { unread: unreadOnly }],
    queryFn: () => notificationsApi.list(unreadOnly),
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  const { data } = useNotifications(true);
  return data?.length ?? 0;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useReplyNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      notificationsApi.reply(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
