import type { MessagingChannel } from '@personally/messaging';
import { CloudApiChannel } from './cloud-api/channel.js';
import { WhatsAppWebJsChannel } from './whatsapp-webjs.js';
import type { ApiClient } from '../api-client.js';

export type ChannelKind = 'wwebjs' | 'cloud';

export interface ChannelFactoryOptions {
  agentVersion: string;
  api: ApiClient;
  /** process.env inyectable para testear sin tocar el ambiente real. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Elige la implementacion de canal segun la env var `CHANNEL`.
 *
 * Default `wwebjs` a proposito: hasta validar la Cloud API en produccion, un
 * deploy sin la variable seteada tiene que seguir comportandose como hoy. El
 * rollback es cambiar la variable y reiniciar — sin redeploy de codigo.
 */
export function resolveChannelKind(env: NodeJS.ProcessEnv = process.env): ChannelKind {
  const raw = (env.CHANNEL ?? 'wwebjs').trim().toLowerCase();
  if (raw === 'wwebjs' || raw === 'cloud') return raw;
  throw new Error(`CHANNEL invalido: "${env.CHANNEL}". Valores validos: wwebjs | cloud`);
}

export function createChannel(opts: ChannelFactoryOptions): MessagingChannel {
  const env = opts.env ?? process.env;
  const kind = resolveChannelKind(env);

  if (kind === 'wwebjs') {
    return new WhatsAppWebJsChannel({ agentVersion: opts.agentVersion, api: opts.api });
  }

  // Fallar aca y no en el primer envio: un token faltante en produccion tiene
  // que romper el arranque, no dejar el outbox drenando errores en silencio.
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const missing = [
    !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
    !accessToken && 'WHATSAPP_ACCESS_TOKEN',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`CHANNEL=cloud requiere ${missing.join(' y ')} en el .env`);
  }

  return new CloudApiChannel({
    phoneNumberId: phoneNumberId!,
    accessToken: accessToken!,
    templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE,
  });
}
