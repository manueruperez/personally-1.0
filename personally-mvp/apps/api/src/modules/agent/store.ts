/**
 * Estado del agente WhatsApp por trainer (in-memory).
 * Para MVP esto esta bien: un solo proceso de API, un solo agente por trainer.
 * En produccion con multiples replicas migrar a Redis.
 */

export type AgentState = 'initializing' | 'online' | 'offline' | 'unknown';

/**
 * Estados que reportaba el agente cuando el canal era whatsapp-web.js. Ya nadie
 * los emite, pero durante un deploy el agente viejo sigue latiendo contra el API
 * nuevo: si el heartbeat los rechazara, el panel mostraria el bot caido por un
 * problema que no existe. Se aceptan y se traducen a `offline`, que es lo que
 * significaban para el trainer (el bot no estaba mandando mensajes).
 *
 * Se pueden borrar en cuanto no queden agentes de la era wwebjs corriendo.
 */
const LEGACY_STATES = ['qr_required', 'authenticating', 'reconnecting'] as const;

export const HEARTBEAT_STATES = ['initializing', 'online', 'offline', ...LEGACY_STATES] as const;

export type HeartbeatState = (typeof HEARTBEAT_STATES)[number];

export function normalizeAgentState(state: HeartbeatState): AgentState {
  return (LEGACY_STATES as readonly string[]).includes(state) ? 'offline' : (state as AgentState);
}

/** Sin latido en este lapso damos el agente por caido. */
const STALE_MS = 2 * 60 * 1000;

export interface AgentStatus {
  trainerId: string;
  state: AgentState;
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
    // El ultimo estado reportado vale mientras el agente siga latiendo. Si dejo
    // de hacerlo el dato quedo congelado y no describe nada: cualquiera sea,
    // pasa a `offline`.
    const age = Date.now() - new Date(found.lastHeartbeatAt).getTime();
    if (age > STALE_MS) {
      return { ...found, state: 'offline' };
    }
    return found;
  }
  return {
    trainerId,
    state: 'unknown',
    uptimeSec: 0,
    lastHeartbeatAt: new Date(0).toISOString(),
    agentVersion: null,
  };
}
