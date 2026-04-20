import { api } from '@/lib/api';
import type { SessionStatus } from '@/features/clients/api';

export interface DashboardSummary {
  totalClients: number;
  sessionsCreated: number;
  greeted: number;
  inProgress: number;
  completed: number;
  partial: number;
  missed: number;
  noSession: number;
  unreadNotifications: number;
  failedMessages: number;
}

export interface DashboardClientSession {
  id: string;
  status: SessionStatus;
  itemsTotal: number;
  itemsDone: number;
  itemsSkipped: number;
  greetedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DashboardClient {
  id: string;
  name: string;
  phone: string;
  preferredStartTime: string | null;
  session: DashboardClientSession | null;
}

export interface DashboardTodayDto {
  summary: DashboardSummary;
  clients: DashboardClient[];
}

export const dashboardApi = {
  today: () => api.get<DashboardTodayDto>('/api/v1/dashboard/today'),
};
