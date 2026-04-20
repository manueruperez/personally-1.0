import { api } from '@/lib/api';

export type AgentState =
  | 'initializing'
  | 'qr_required'
  | 'authenticating'
  | 'online'
  | 'reconnecting'
  | 'offline'
  | 'unknown';

export interface AgentStatusDto {
  trainerId: string;
  state: AgentState;
  qr: string | null;
  uptimeSec: number;
  lastHeartbeatAt: string;
  agentVersion: string | null;
}

export const agentApi = {
  status: () => api.get<AgentStatusDto>('/api/v1/agent/status'),
  reconnect: () => api.post<{ commanded: boolean }>('/api/v1/agent/reconnect', {}),
};
