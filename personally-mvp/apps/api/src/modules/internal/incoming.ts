import { prisma } from '@personally/db';
import { KeywordIntentClassifier } from '@personally/nlu';
import type { ContentType, Intent } from '@personally/types';
import { logger } from '../../lib/logger.js';
import { dispatch } from './dispatcher.js';

const classifier = new KeywordIntentClassifier();

export interface IncomingPayload {
  externalId: string;
  receivedAt: Date | string;
  contentType: ContentType;
  contentText?: string;
  mediaUrl?: string;
}

export type IncomingResult =
  | { ignored: true; reason: 'unknown_client' }
  | {
      ignored?: false;
      messageId: string;
      sessionId: string | null;
      intent: string;
      confidence: number;
      triggeredAction: string;
    };

/**
 * Serializa el procesamiento de mensajes entrantes por cliente. Evita race
 * conditions cuando el cliente manda 2 mensajes casi simultaneos (ej. "iniciar"
 * + "iniciar"): sin esto, ambos dispatches leen la sesion antes de que el
 * primero escriba y terminan avanzando 2 items en vez de 1.
 *
 * Es in-memory (un solo nodo API). Si escalamos a N instancias habra que mover
 * esto a un lock distribuido (Redis/Postgres advisory lock).
 */
const clientMutex = new Map<string, Promise<unknown>>();

async function withClientLock<T>(clientId: string, fn: () => Promise<T>): Promise<T> {
  const prev = clientMutex.get(clientId) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  clientMutex.set(clientId, run);
  try {
    return await run;
  } finally {
    if (clientMutex.get(clientId) === run) clientMutex.delete(clientId);
  }
}

/**
 * Procesa un mensaje entrante de un cliente, venga del agente whatsapp-web.js
 * o del webhook de la Cloud API.
 *
 * 1. Persiste el mensaje en `messages` con direction=inbound.
 * 2. Clasifica intent.
 * 3. Dispatcha segun intent + estado de sesion → encola respuestas al outbox.
 */
export async function processIncomingMessage(
  phone: string,
  payload: IncomingPayload,
): Promise<IncomingResult> {
  const client = await prisma.client.findFirst({
    where: { phone },
    include: { preferences: true },
  });
  if (!client) {
    logger.warn({ phone }, 'Incoming de cliente desconocido');
    return { ignored: true, reason: 'unknown_client' };
  }

  // Sesion activa (si la hay)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const session = await prisma.session.findFirst({
    where: { clientId: client.id, scheduledDate: today },
  });

  const classification = await classifier.classify(payload.contentText ?? '', {
    sessionState: mapSessionState(session?.status),
  });

  const msg = await prisma.message.create({
    data: {
      organizationId: client.organizationId,
      clientId: client.id,
      sessionId: session?.id ?? null,
      direction: 'inbound',
      channel: 'whatsapp',
      externalId: payload.externalId,
      sentAt: payload.receivedAt,
      receivedAt: payload.receivedAt,
      contentType: payload.contentType,
      contentText: payload.contentText ?? null,
      mediaUrl: payload.mediaUrl ?? null,
      intentDetected: classification.intent,
      intentConfidence: classification.confidence,
    },
  });

  let triggeredAction = 'none';
  let resolvedSessionId: string | null = session?.id ?? null;
  try {
    const result = await withClientLock(client.id, () =>
      dispatch({
        clientId: client.id,
        trainerId: client.trainerId,
        organizationId: client.organizationId,
        phone: client.phone,
        clientName: client.name,
        intent: classification.intent as Intent,
        messageText: payload.contentText ?? '',
      }),
    );
    triggeredAction = result.triggeredAction;
    resolvedSessionId = result.sessionId ?? resolvedSessionId;

    // Update el mensaje entrante con la accion disparada
    if (triggeredAction !== 'none') {
      await prisma.message.update({
        where: { id: msg.id },
        data: {
          triggeredAction,
          ...(result.sessionId && !session ? { sessionId: result.sessionId } : {}),
          ...(result.exerciseLogId ? { exerciseLogId: result.exerciseLogId } : {}),
        },
      });
    }
  } catch (err) {
    logger.error({ err, messageId: msg.id }, 'dispatcher failed');
  }

  return {
    messageId: msg.id,
    sessionId: resolvedSessionId,
    intent: classification.intent,
    confidence: classification.confidence,
    triggeredAction,
  };
}

function mapSessionState(
  status?: string,
): 'idle' | 'greeted' | 'in_warmup' | 'in_exercise' | 'in_cooldown' | 'paused' | undefined {
  if (!status) return undefined;
  if (status === 'scheduled') return 'idle';
  if (status === 'greeted') return 'greeted';
  if (status === 'in_progress') return 'in_exercise';
  return undefined;
}
