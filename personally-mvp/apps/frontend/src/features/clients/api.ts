import { api } from '@/lib/api';

export interface ClientPreferenceDto {
  timezone: string;
  preferredStartTime: string;
  reminderEnabled: boolean;
  silenceAfterFinish: boolean;
}

export interface ClientDto {
  id: string;
  organizationId: string;
  trainerId: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
  preferences?: ClientPreferenceDto | null;
}

export interface CreateClientPayload {
  name: string;
  phone: string;
  email?: string;
  preferences?: Partial<ClientPreferenceDto>;
}

export interface UpdateClientPayload extends Partial<CreateClientPayload> {
  status?: 'active' | 'paused' | 'archived';
}

export type ClientStatusFilter = 'active' | 'paused' | 'archived' | 'all';

export type SessionStatus =
  | 'scheduled'
  | 'greeted'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'missed'
  | 'abandoned';

export type LogStatus =
  | 'pending'
  | 'presented'
  | 'done'
  | 'skipped'
  | 'changed'
  | 'missed'
  | 'deferred';

export interface TodaySessionLog {
  id: string;
  orderInSession: number;
  status: LogStatus;
  block: 'warmup' | 'exercise' | 'cooldown';
  exerciseName: string;
  exerciseImageUrl: string | null;
  sets: number | null;
  reps: string | null;
  deferCount: number;
  notes: string | null;
}

export interface TodaySessionDto {
  id: string;
  status: SessionStatus;
  scheduledDate: string;
  greetedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  itemsTotal: number;
  itemsDone: number;
  itemsSkipped: number;
  logs: TodaySessionLog[];
}

export const clientsApi = {
  list: (status: ClientStatusFilter = 'active') =>
    api.get<ClientDto[]>(`/api/v1/clients?status=${status}`),
  get: (id: string) => api.get<ClientDto>(`/api/v1/clients/${id}`),
  create: (body: CreateClientPayload) => api.post<ClientDto>('/api/v1/clients', body),
  update: (id: string, body: UpdateClientPayload) => api.patch<ClientDto>(`/api/v1/clients/${id}`, body),
  archive: (id: string) => api.delete<ClientDto>(`/api/v1/clients/${id}`),
  sendTestMessage: (id: string, text: string) =>
    api.post<{ queued: boolean; outboxId: string; enqueuedAt: string }>(
      `/api/v1/clients/${id}/send-test-message`,
      { text },
    ),
  todaySession: (id: string) =>
    api.get<TodaySessionDto | null>(`/api/v1/clients/${id}/today-session`),
  resetTodaySession: (id: string) =>
    api.delete<{ deleted: boolean; sessionId?: string }>(
      `/api/v1/clients/${id}/today-session`,
    ),
  sendDailyGreeting: (id: string) =>
    api.post<{ queued: boolean }>(`/api/v1/clients/${id}/send-daily-greeting`, {}),
};
