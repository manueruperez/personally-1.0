import type { MessagingChannel } from '@personally/messaging';
import type { ApiClient } from './api-client.js';
import { logger } from './logger.js';

const INTERVAL_MS = 60_000;

export function startHeartbeat(deps: { channel: MessagingChannel; api: ApiClient }) {
  const { channel, api } = deps;
  const startedAt = Date.now();
  const trainerId = process.env.AGENT_TRAINER_ID ?? '';

  if (!trainerId) {
    logger.warn('AGENT_TRAINER_ID no seteado; heartbeat con trainerId vacio');
  }

  async function send() {
    try {
      await api.postHeartbeat({
        trainerId,
        state: channel.getSessionState(),
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        qr: channel.getQrCode(),
      });
    } catch (err) {
      logger.warn({ err }, 'heartbeat failed');
    }
  }

  // Primer heartbeat inmediato + intervalo
  send();
  setInterval(send, INTERVAL_MS);

  // Heartbeat extra en cada cambio de estado (QR aparece mas rapido en UI)
  channel.onSessionStateChange(() => {
    send();
  });
}
