/**
 * Estado del agente WhatsApp por trainer (in-memory).
 * Para MVP esto esta bien: un solo proceso de API, un solo agente por trainer.
 * En produccion con multiples replicas migrar a Redis.
 */

export type AgentState =
  | 'initializing'
  | 'qr_required'
  | 'authenticating'
  | 'online'
  | 'reconnecting'
  | 'offline'
  | 'unknown';

export interface AgentStatus {
  trainerId: string;
  state: AgentState;
  qr: string | null;
  uptimeSec: number;
  lastHeartbeatAt: string; // ISO
  agentVersion: string | null;
}

const statuses = new Map<string, AgentStatus>();

export function updateAgentStatus(s: Omit<AgentStatus, 'lastHeartbeatAt'>): AgentStatus {
  const full: AgentStatus = {
    ...s,
    lastHeartbeatAt: new Date().toISOString(),
  };
  statuses.set(s.trainerId, full);
  return full;
}

export function getAgentStatus(trainerId: string): AgentStatus {
  const found = statuses.get(trainerId);
  if (found) {
    // Si no ha hecho heartbeat en > 2 min → offline
    const age = Date.now() - new Date(found.lastHeartbeatAt).getTime();
    if (age > 2 * 60 * 1000 && found.state === 'online') {
      return { ...found, state: 'offline' };
    }
    return found;
  }
  return {
    trainerId,
    state: 'unknown',
    qr: null,
    uptimeSec: 0,
    lastHeartbeatAt: new Date(0).toISOString(),
    agentVersion: null,
  };
}
