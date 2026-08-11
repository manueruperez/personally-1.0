import { Router } from 'express';
import { logger } from '../../lib/logger.js';
import { processIncomingMessage } from '../internal/incoming.js';
import { normalizeWebhookPayload } from './payload.js';
import { verifyMetaSignature } from './signature.js';

export const webhooksRouter: Router = Router();

/**
 * Verificacion del endpoint: Meta pega un GET con un challenge al dar de alta
 * el webhook y espera que le devolvamos el valor tal cual, en texto plano.
 * Solo ocurre en el alta y cuando se re-suscribe.
 */
webhooksRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected) {
    logger.info('webhook whatsapp verificado por Meta');
    res.type('text/plain').send(String(challenge ?? ''));
    return;
  }

  logger.warn({ mode }, 'verificacion de webhook rechazada');
  res.sendStatus(403);
});

/**
 * Recepcion de eventos.
 *
 * Responde 200 lo antes posible y procesa despues: Meta corta a los ~20s y
 * reintenta el evento si no ve el 200, lo que duplicaria mensajes. Un error
 * del dispatcher no debe traducirse en un reintento de Meta.
 */
webhooksRouter.post('/whatsapp', (req, res) => {
  const ok = verifyMetaSignature(
    (req as { rawBody?: Buffer }).rawBody,
    req.get('x-hub-signature-256'),
    process.env.WHATSAPP_APP_SECRET ?? '',
  );

  if (!ok) {
    logger.warn('webhook con firma invalida rechazado');
    res.sendStatus(401);
    return;
  }

  const messages = normalizeWebhookPayload(req.body);
  res.sendStatus(200);

  for (const msg of messages) {
    processIncomingMessage(msg.phone, {
      externalId: msg.externalId,
      receivedAt: msg.receivedAt,
      contentType: msg.contentType,
      contentText: msg.contentText,
    }).catch((err) => {
      logger.error({ err, externalId: msg.externalId }, 'webhook: fallo procesando entrante');
    });
  }
});
