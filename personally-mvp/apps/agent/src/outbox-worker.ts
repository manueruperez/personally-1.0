import type { MessagingChannel } from '@personally/messaging';
import type { ApiClient, OutboxMessage } from './api-client.js';
import { logger } from './logger.js';
import { subscribeToEvents } from './sse-client.js';

// Polling como red de seguridad (mas lento porque SSE lleva el camino caliente).
const POLL_FALLBACK_MS = 15_000;

export function startOutboxWorker(deps: { channel: MessagingChannel; api: ApiClient }) {
  const { channel, api } = deps;
  const trainerId = process.env.AGENT_TRAINER_ID ?? '';
  if (!trainerId) {
    logger.warn('AGENT_TRAINER_ID no seteado; outbox worker inactivo');
    return;
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
  const agentToken = process.env.AGENT_TOKEN ?? '';

  let draining = false;

  async function drain() {
    if (draining) return;
    if (channel.getSessionState() !== 'online') return;

    draining = true;
    try {
      let msg = await api.takeNextOutbox(trainerId);
      while (msg) {
        await processOne(msg, deps);
        msg = await api.takeNextOutbox(trainerId);
      }
    } catch (err) {
      logger.warn({ err: String(err) }, 'outbox drain failed');
    } finally {
      draining = false;
    }
  }

  // 1) SSE: camino caliente. Llama drain() al recibir `event: outbox`.
  //    Tambien maneja `event: command` para reinit remoto desde la API.
  void subscribeToEvents({
    url: `${apiBaseUrl}/api/v1/internal/events?trainerId=${encodeURIComponent(trainerId)}`,
    token: agentToken,
    onOutbox: () => {
      void drain();
    },
    onCommand: (cmd) => {
      if (cmd.type === 'reinit') {
        logger.warn('comando reinit recibido, reinicializando cliente');
        if ('reinit' in channel && typeof (channel as { reinit?: () => void }).reinit === 'function') {
          (channel as { reinit: () => void }).reinit();
        }
      }
    },
  });

  // 2) Polling de respaldo: si SSE se cayo y reconecta, igual drenamos periodicamente.
  setInterval(drain, POLL_FALLBACK_MS);

  // 3) Drenar al conectar WhatsApp. Delay de 15s para darle tiempo a Puppeteer
  //    a estabilizarse — sin esto, el primer send suele tirar `detached frame`
  //    porque el DOM de WhatsApp Web aun se esta hidratando.
  channel.onSessionStateChange((state) => {
    if (state === 'online') {
      setTimeout(() => void drain(), 15_000);
    }
  });
}

async function processOne(
  msg: OutboxMessage,
  deps: { channel: MessagingChannel; api: ApiClient },
): Promise<void> {
  const { channel, api } = deps;
  logger.info({ outboxId: msg.id, phone: msg.phone }, 'sending outbox message');

  try {
    const sent = await channel.send(msg.phone, {
      contentType: msg.contentType,
      text: msg.text,
      mediaUrl: msg.mediaUrl,
      caption: msg.caption,
      templateKey: msg.templateKey,
    });

    await api.postOutgoing(msg.phone, {
      externalId: sent.externalId,
      sentAt: sent.sentAt.toISOString(),
      contentType: msg.contentType,
      contentText: msg.text,
      mediaUrl: msg.mediaUrl,
      templateKey: msg.templateKey,
      isTemplateBased: msg.isTemplateBased,
      sessionId: msg.sessionId ?? undefined,
      exerciseLogId: msg.exerciseLogId ?? undefined,
    });
  } catch (err) {
    logger.error({ err, outboxId: msg.id }, 'failed to send outbox message');
    try {
      await api.postOutgoing(msg.phone, {
        externalId: `failed-${msg.id}`,
        sentAt: new Date().toISOString(),
        contentType: msg.contentType,
        contentText: msg.text,
        templateKey: msg.templateKey,
        isTemplateBased: msg.isTemplateBased,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      /* nothing */
    }
  }
}
