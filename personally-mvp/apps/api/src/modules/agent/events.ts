import { EventEmitter } from 'node:events';

/**
 * Pub/sub in-memory para avisarle al agente (via SSE) que hay items nuevos en su
 * outbox. Es el camino caliente; el polling del agente queda como red de
 * seguridad si el stream se cae.
 */
export const outboxEvents = new EventEmitter();
outboxEvents.setMaxListeners(100);

export function notifyOutbox(trainerId: string, payload: { id: string }): void {
  outboxEvents.emit(`outbox:${trainerId}`, payload);
}
