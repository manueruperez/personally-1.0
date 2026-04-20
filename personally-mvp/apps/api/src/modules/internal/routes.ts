import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@personally/db';
import { DomainError } from '@personally/core';
import { incomingMessageInput, outgoingMessageInput } from '@personally/types';
import { KeywordIntentClassifier } from '@personally/nlu';
import { validate } from '../../middleware/validate.js';
import { logger } from '../../lib/logger.js';
import { updateAgentStatus } from '../agent/store.js';
import { takeNext } from '../agent/outbox.js';
import { outboxEvents, commandEvents, type AgentCommand } from '../agent/events.js';
import { dispatch } from './dispatcher.js';
import type { Intent } from '@personally/types';

export const internalRouter: Router = Router();

const classifier = new KeywordIntentClassifier();

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
 * Agente recibio un mensaje entrante del cliente.
 * 1. Persiste el mensaje en `messages` con direction=inbound.
 * 2. Clasifica intent.
 * 3. Busca sesion activa y responde al agente con proxima accion.
 */
internalRouter.post(
  '/clients/:phone/incoming-message',
  validate({
    params: z.object({ phone: z.string() }),
    body: incomingMessageInput,
  }),
  async (req, res, next) => {
    try {
      const client = await prisma.client.findFirst({
        where: { phone: req.params.phone },
        include: { preferences: true },
      });
      if (!client) {
        logger.warn({ phone: req.params.phone }, 'Incoming de cliente desconocido');
        return res.json({ data: { ignored: true, reason: 'unknown_client' } });
      }

      // Sesion activa (si la hay)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const session = await prisma.session.findFirst({
        where: { clientId: client.id, scheduledDate: today },
      });

      const classification = await classifier.classify(req.body.contentText ?? '', {
        sessionState: mapSessionState(session?.status),
      });

      const msg = await prisma.message.create({
        data: {
          organizationId: client.organizationId,
          clientId: client.id,
          sessionId: session?.id ?? null,
          direction: 'inbound',
          channel: 'whatsapp',
          externalId: req.body.externalId,
          sentAt: req.body.receivedAt,
          receivedAt: req.body.receivedAt,
          contentType: req.body.contentType,
          contentText: req.body.contentText ?? null,
          mediaUrl: req.body.mediaUrl ?? null,
          intentDetected: classification.intent,
          intentConfidence: classification.confidence,
        },
      });

      // Dispatch segun intent + estado actual → encola respuestas al outbox.
      // Lock por cliente para serializar mensajes concurrentes.
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
            messageText: req.body.contentText ?? '',
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

      res.json({
        data: {
          messageId: msg.id,
          sessionId: resolvedSessionId,
          intent: classification.intent,
          confidence: classification.confidence,
          triggeredAction,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

internalRouter.post(
  '/clients/:phone/outgoing-message',
  validate({
    params: z.object({ phone: z.string() }),
    body: outgoingMessageInput,
  }),
  async (req, res, next) => {
    try {
      const client = await prisma.client.findFirst({ where: { phone: req.params.phone } });
      if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');

      const msg = await prisma.message.create({
        data: {
          organizationId: client.organizationId,
          clientId: client.id,
          sessionId: req.body.sessionId ?? null,
          direction: 'outbound',
          channel: 'whatsapp',
          externalId: req.body.externalId,
          sentAt: req.body.sentAt,
          contentType: req.body.contentType,
          contentText: req.body.contentText ?? null,
          mediaUrl: req.body.mediaUrl ?? null,
          templateKey: req.body.templateKey ?? null,
          isTemplateBased: req.body.isTemplateBased ?? null,
          agentVersion: req.body.agentVersion ?? null,
          error: req.body.error ?? null,
          exerciseLogId: req.body.exerciseLogId ?? null,
        },
      });
      res.json({ data: { messageId: msg.id } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Heartbeat del agente. Se usa para detectar agentes caidos.
 */
const heartbeatBody = z.object({
  trainerId: z.string().uuid(),
  state: z.enum(['initializing', 'qr_required', 'authenticating', 'online', 'reconnecting', 'offline']),
  uptimeSec: z.number().int().min(0),
  agentVersion: z.string().optional(),
  qr: z.string().nullable().optional(),
});

internalRouter.get(
  '/outbox/next',
  validate({ query: z.object({ trainerId: z.string().uuid() }) }),
  (req, res, next) => {
    try {
      const trainerId = (req.query as { trainerId: string }).trainerId;
      const msg = takeNext(trainerId);
      res.json({ data: msg });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * SSE stream: notifica al agente cuando hay items nuevos en su outbox.
 * El agente consume takeNext() al recibir el evento. Polling queda como red de seguridad.
 */
internalRouter.get(
  '/events',
  validate({ query: z.object({ trainerId: z.string().uuid() }) }),
  (req, res) => {
    const trainerId = (req.query as { trainerId: string }).trainerId;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`: connected ${new Date().toISOString()}\n\n`);

    const outboxChannel = `outbox:${trainerId}`;
    const cmdChannel = `command:${trainerId}`;

    const onOutbox = (payload: { id: string }) => {
      res.write(`event: outbox\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    const onCommand = (cmd: AgentCommand) => {
      res.write(`event: command\ndata: ${JSON.stringify(cmd)}\n\n`);
    };
    outboxEvents.on(outboxChannel, onOutbox);
    commandEvents.on(cmdChannel, onCommand);

    const keepalive = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 20_000);

    const cleanup = () => {
      clearInterval(keepalive);
      outboxEvents.off(outboxChannel, onOutbox);
      commandEvents.off(cmdChannel, onCommand);
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
  },
);

internalRouter.post(
  '/agent/heartbeat',
  validate({ body: heartbeatBody }),
  async (req, res, next) => {
    try {
      const { trainerId, state, uptimeSec, agentVersion, qr } = req.body as z.infer<
        typeof heartbeatBody
      >;
      const status = updateAgentStatus({
        trainerId,
        state,
        qr: qr ?? null,
        uptimeSec,
        agentVersion: agentVersion ?? null,
      });
      logger.debug({ state: status.state }, 'agent heartbeat');
      res.json({ data: { ok: true, at: status.lastHeartbeatAt } });
    } catch (err) {
      next(err);
    }
  },
);

function mapSessionState(
  status?: string,
): 'idle' | 'greeted' | 'in_warmup' | 'in_exercise' | 'in_cooldown' | 'paused' | undefined {
  if (!status) return undefined;
  if (status === 'scheduled') return 'idle';
  if (status === 'greeted') return 'greeted';
  if (status === 'in_progress') return 'in_exercise';
  return undefined;
}
