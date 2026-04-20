import type { MessagingChannel, IncomingMessage } from '@personally/messaging';
import type { ApiClient } from '../api-client.js';
import { logger } from '../logger.js';

export function createIncomingHandler(deps: { channel: MessagingChannel; api: ApiClient }) {
  const { api } = deps;

  return async (msg: IncomingMessage) => {
    logger.info({ from: msg.from, contentType: msg.contentType }, 'incoming');

    // 1. Persistir mensaje + obtener intent
    const result = await api.postIncoming(msg.from, {
      externalId: msg.externalId,
      receivedAt: msg.receivedAt.toISOString(),
      contentType: msg.contentType,
      contentText: msg.text,
      mediaUrl: msg.mediaUrl,
    });

    logger.debug({ result }, 'incoming processed');

    // 2. Ejecutar action que devolvio la API
    // TODO: una vez implementado el dispatcher, responder segun `triggeredAction`
    // Por ahora solo log.
    if (result.intent === 'UNKNOWN') {
      logger.info({ from: msg.from }, 'intent UNKNOWN - revisar para mejorar NLU');
    }
  };
}
