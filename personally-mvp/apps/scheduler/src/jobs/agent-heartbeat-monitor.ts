import { logger } from '../logger.js';

/**
 * Vigila heartbeats del agente. Cuando >5 min sin heartbeat ->
 * notificacion `agent_offline`. Cuando vuelve -> `agent_reconnected`.
 *
 * TODO: persistir heartbeats (tabla agent_status o Redis) y comparar.
 */
export async function agentHeartbeatMonitor(): Promise<void> {
  logger.debug('agent-heartbeat-monitor placeholder');
}
