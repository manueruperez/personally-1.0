import { api } from '@/lib/api';

/** `unknown` es del API, no del canal: el agente todavia no reporto nada. */
export type AgentState = 'initializing' | 'online' | 'offline' | 'unknown';

export interface AgentStatusDto {
  trainerId: string;
  state: AgentState;
  uptimeSec: number;
  lastHeartbeatAt: string;
  agentVersion: string | null;
}

export const agentApi = {
  status: () => api.get<AgentStatusDto>('/api/v1/agent/status'),
};
