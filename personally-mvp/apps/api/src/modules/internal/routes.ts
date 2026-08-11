import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@personally/db';
import { DomainError } from '@personally/core';
import { incomingMessageInput, outgoingMessageInput } from '@personally/types';
import { validate } from '../../middleware/validate.js';
import { logger } from '../../lib/logger.js';
import { updateAgentStatus } from '../agent/store.js';
import { takeNext } from '../agent/outbox.js';
import { outboxEvents, commandEvents, type AgentCommand } from '../agent/events.js';
import { processIncomingMessage } from './incoming.js';

export const internalRouter: Router = Router();

/**
 * Agente recibio un mensaje entrante del cliente. La logica vive en
 * `processIncomingMessage` porque el webhook de la Cloud API entra por el
 * mismo camino (ver modules/webhooks).
 */
internalRouter.post(
  '/clients/:phone/incoming-message',
  validate({
    params: z.object({ phone: z.string() }),
    body: incomingMessageInput,
  }),
  async (req, res, next) => {
    try {
      // `validate` ya garantizo que el param existe; con noUncheckedIndexedAccess
      // el indexado de params igual tipa como `string | undefined`.
      const { phone } = req.params as { phone: string };
      const result = await processIncomingMessage(phone, {
        externalId: req.body.externalId,
        receivedAt: req.body.receivedAt,
        contentType: req.body.contentType,
        contentText: req.body.contentText,
        mediaUrl: req.body.mediaUrl,
      });
      res.json({ data: result });
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
