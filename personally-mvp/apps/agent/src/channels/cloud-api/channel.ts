import type {
  IncomingMessageHandler,
  MessagingChannel,
  OutgoingMessage,
  SendResult,
  SessionState,
  SessionStateHandler,
} from '@personally/messaging';
import { logger } from '../../logger.js';
import { sendImage, sendTemplate, sendText, type CloudApiConfig } from './client.js';

/**
 * Plantillas registradas en Meta, por `templateKey` del dispatcher.
 *
 * Solo el saludo diario necesita plantilla: es el unico mensaje que se manda
 * fuera de la ventana de 24h. `exercise_card` y `finish` van dentro de la
 * ventana (el cliente ya respondio) y por eso salen como mensajes de sesion.
 *
 * `params` es la cantidad de placeholders del cuerpo aprobado. Se valida antes
 * de llamar a Meta: un desajuste da 400 y el mensaje se pierde, y el error de
 * Meta no dice cual de las dos puntas esta mal.
 */
export const TEMPLATES: Record<string, { name: string; params: number }> = {
  greeting: { name: 'greeting', params: 3 },
};

export interface CloudApiChannelOptions extends CloudApiConfig {
  /** Codigo de idioma de las plantillas registradas en Meta. Default: es. */
  templateLanguage?: string;
}

/**
 * Implementacion de MessagingChannel sobre la Cloud API oficial de Meta.
 *
 * No hay sesion que mantener: no hay Chromium, ni QR, ni reconexion — la
 * credencial es un token permanente. Los entrantes NO llegan por aca sino por el
 * webhook del API (ver apps/api .../webhooks), asi que `onIncoming` existe solo
 * para cumplir la interfaz.
 */
export class CloudApiChannel implements MessagingChannel {
  private readonly cfg: CloudApiConfig;
  private readonly templateLanguage: string;
  private readonly stateHandlers: SessionStateHandler[] = [];

  constructor(opts: CloudApiChannelOptions) {
    this.cfg = {
      phoneNumberId: opts.phoneNumberId,
      accessToken: opts.accessToken,
      baseUrl: opts.baseUrl,
    };
    this.templateLanguage = opts.templateLanguage ?? 'es';
  }

  /** No-op: la Cloud API es stateless. Notifica `online` para el heartbeat. */
  async start(): Promise<void> {
    for (const h of this.stateHandlers) h('online');
    logger.info({ phoneNumberId: this.cfg.phoneNumberId }, 'canal cloud-api listo');
  }

  /** No-op: no hay conexion que cerrar. */
  async stop(): Promise<void> {}

  /** Siempre `online`: no existe estado de sesion que pueda caerse. */
  getSessionState(): SessionState {
    return 'online';
  }

  /**
   * Los entrantes llegan por webhook al API, no por este proceso. Se acepta el
   * handler para cumplir la interfaz pero nunca se invoca.
   */
  onIncoming(_handler: IncomingMessageHandler): void {}

  onSessionStateChange(handler: SessionStateHandler): void {
    this.stateHandlers.push(handler);
  }

  async send(to: string, message: OutgoingMessage): Promise<SendResult> {
    const wamid = await this.route(to, message);
    // Meta no devuelve timestamp de envio; el momento de la respuesta 200 es la
    // mejor aproximacion y es lo que el historial necesita para ordenar.
    return { externalId: wamid, sentAt: new Date() };
  }

  private route(to: string, message: OutgoingMessage): Promise<string> {
    const template = message.templateKey ? TEMPLATES[message.templateKey] : undefined;

    if (template) {
      const params = message.templateParams ?? [];
      if (params.length !== template.params) {
        throw new Error(
          `plantilla ${template.name}: se esperaban ${template.params} variables y llegaron ${params.length}`,
        );
      }
      return sendTemplate(this.cfg, to, template.name, this.templateLanguage, params);
    }

    if (message.mediaUrl && (message.contentType === 'image' || message.contentType === 'video')) {
      return sendImage(this.cfg, to, message.mediaUrl, message.caption);
    }

    if (message.text) {
      return sendText(this.cfg, to, message.text);
    }

    throw new Error('OutgoingMessage sin contenido');
  }
}
