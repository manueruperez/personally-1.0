import { EventEmitter } from 'node:events';

/**
 * Pub/sub in-memory para notificar a suscriptores (agentes via SSE).
 *   outboxEvents  — hay items nuevos en el outbox (camino hot).
 *   commandEvents — comandos puntuales al agente (reinit, ping).
 */
export const outboxEvents = new EventEmitter();
outboxEvents.setMaxListeners(100);

export const commandEvents = new EventEmitter();
commandEvents.setMaxListeners(100);

export function notifyOutbox(trainerId: string, payload: { id: string }): void {
  outboxEvents.emit(`outbox:${trainerId}`, payload);
}

export type AgentCommand = { type: 'reinit' } | { type: 'ping' };

export function sendAgentCommand(trainerId: string, command: AgentCommand): void {
  commandEvents.emit(`command:${trainerId}`, command);
}
