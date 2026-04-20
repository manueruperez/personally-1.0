import { api } from '@/lib/api';

export type NotificationType =
  | 'change_request'
  | 'pain_report'
  | 'silent_client'
  | 'agent_offline';

export interface NotificationDto {
  id: string;
  organizationId: string;
  trainerId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: {
    clientId?: string;
    sessionId?: string;
    exerciseLogId?: string | null;
    exerciseName?: string | null;
  } | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<NotificationDto[]>(
      `/api/v1/notifications${unreadOnly ? '?unread=true' : ''}`,
    ),
  markRead: (id: string) => api.post<NotificationDto>(`/api/v1/notifications/${id}/read`, {}),
  reply: (id: string, text: string) =>
    api.post<{ queued: boolean; notification: NotificationDto }>(
      `/api/v1/notifications/${id}/reply`,
      { text },
    ),
};
