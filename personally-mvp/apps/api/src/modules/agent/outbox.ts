import { randomUUID } from 'node:crypto';
import { notifyOutbox } from './events.js';

/**
 * Outbox in-memory: cola de mensajes pendientes de envio, agrupados por trainer.
 * El agente (autenticado con AGENT_TOKEN + trainerId) hace poll y los envia.
 *
 * En produccion con multiples replicas de API, migrar a Redis/BullMQ.
 */

export type OutboxContentType = 'text' | 'image' | 'video';

export interface OutboxMessage {
  id: string;
  trainerId: string;
  clientId: string;
  phone: string;
  sessionId: string | null;
  exerciseLogId: string | null;
  contentType: OutboxContentType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  templateKey?: string;
  isTemplateBased: boolean;
  enqueuedAt: string;
}

const queues = new Map<string, OutboxMessage[]>();

export interface EnqueueInput {
  trainerId: string;
  clientId: string;
  phone: string;
  sessionId?: string;
  exerciseLogId?: string;
  contentType?: OutboxContentType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  templateKey?: string;
  isTemplateBased?: boolean;
}

export function enqueue(input: EnqueueInput): OutboxMessage {
  const msg: OutboxMessage = {
    id: randomUUID(),
    trainerId: input.trainerId,
    clientId: input.clientId,
    phone: input.phone,
    sessionId: input.sessionId ?? null,
    exerciseLogId: input.exerciseLogId ?? null,
    contentType: input.contentType ?? 'text',
    text: input.text,
    mediaUrl: input.mediaUrl,
    caption: input.caption,
    templateKey: input.templateKey,
    isTemplateBased: input.isTemplateBased ?? false,
    enqueuedAt: new Date().toISOString(),
  };
  const q = queues.get(input.trainerId) ?? [];
  q.push(msg);
  queues.set(input.trainerId, q);
  notifyOutbox(input.trainerId, { id: msg.id });
  return msg;
}

/** El agente pide el siguiente mensaje (FIFO). Devuelve null si esta vacio. */
export function takeNext(trainerId: string): OutboxMessage | null {
  const q = queues.get(trainerId);
  if (!q || q.length === 0) return null;
  return q.shift() ?? null;
}

export function pendingCount(trainerId: string): number {
  return queues.get(trainerId)?.length ?? 0;
}
