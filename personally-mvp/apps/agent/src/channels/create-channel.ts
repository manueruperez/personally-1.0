import type { MessagingChannel } from '@personally/messaging';
import { CloudApiChannel } from './cloud-api/channel.js';

export interface CreateChannelOptions {
  /** process.env inyectable para testear sin tocar el ambiente real. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Construye el canal de salida del agente.
 *
 * Ya no es una fabrica — queda una sola implementacion — pero la funcion se
 * conserva por la validacion de credenciales: sin ella, un token faltante en
 * produccion recien se nota en el primer envio, con el outbox drenando errores
 * en silencio. Fallar al arrancar es ruidoso y se ve en el `docker logs`.
 */
export function createChannel(opts: CreateChannelOptions = {}): MessagingChannel {
  const env = opts.env ?? process.env;

  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const missing = [
    !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
    !accessToken && 'WHATSAPP_ACCESS_TOKEN',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`el canal de WhatsApp requiere ${missing.join(' y ')} en el .env`);
  }

  return new CloudApiChannel({
    phoneNumberId: phoneNumberId!,
    accessToken: accessToken!,
    templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE,
  });
}
