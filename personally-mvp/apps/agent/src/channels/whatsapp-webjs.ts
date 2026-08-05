import { randomUUID } from 'node:crypto';
import path from 'node:path';
import qrcodeTerminal from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import type {
  IncomingMessage,
  IncomingMessageHandler,
  MessagingChannel,
  OutgoingMessage,
  SendResult,
  SessionState,
  SessionStateHandler,
} from '@personally/messaging';
import { logger } from '../logger.js';
import { buildPuppeteerConfig } from '../puppeteer-config.js';
import type { ApiClient } from '../api-client.js';

const { Client, LocalAuth, MessageMedia } = pkg;

/** Margen tras `authenticated` antes de dar la sesion por usable sin `ready`. */
const READY_FALLBACK_MS = 45_000;

export interface WhatsAppWebJsOptions {
  agentVersion: string;
  api: ApiClient;
  /** Carpeta base para persistir sesion (LocalAuth). Default: ./.wwebjs_auth */
  dataPath?: string;
}

/**
 * Implementacion de MessagingChannel sobre whatsapp-web.js + LocalAuth.
 * Ver specs/bots/01-agente-whatsapp.md y aprendizajes/03-wa-bot.md.
 */
export class WhatsAppWebJsChannel implements MessagingChannel {
  private readonly client: InstanceType<typeof Client>;
  private state: SessionState = 'initializing';
  private qr: string | null = null;
  private readonly incomingHandlers: IncomingMessageHandler[] = [];
  private readonly stateHandlers: SessionStateHandler[] = [];
  private readonly agentVersion: string;
  private readyFallbackTimer: NodeJS.Timeout | null = null;

  constructor(opts: WhatsAppWebJsOptions) {
    this.agentVersion = opts.agentVersion;
    const dataPath = opts.dataPath ?? path.resolve(process.cwd(), '.wwebjs_auth');

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath }),
      puppeteer: buildPuppeteerConfig(),
    });

    this.client.on('qr', (qr) => {
      this.qr = qr;
      this.setState('qr_required', { qrPrinted: true });
      qrcodeTerminal.generate(qr, { small: true });
      logger.info('QR listo, escanealo con el WhatsApp del bot');
    });

    this.client.on('authenticated', () => {
      this.qr = null;
      this.setState('authenticating');
      this.armReadyFallback();
    });

    this.client.on('ready', () => {
      this.clearReadyFallback();
      this.setState('online');
      logger.info('WhatsApp listo');
    });

    this.client.on('disconnected', (reason) => {
      this.setState('offline', { reason: String(reason) });
    });

    this.client.on('change_state', (s) => {
      logger.debug({ waState: s }, 'wa state');
    });

    this.client.on('message', (m) => this.handleIncoming(m).catch((err) => logger.error({ err })));
  }

  /**
   * whatsapp-web.js 1.34.x deja de emitir `ready` contra WhatsApp Web 2.3000.x
   * (bug abierto upstream desde ene-2026). El outbox solo drena en `online`, asi
   * que sin este respaldo la sesion queda autenticada pero inutil. Pasado el
   * margen damos la sesion por usable; si en realidad no lo esta, el envio falla
   * por su propia via y queda registrado como error.
   */
  private armReadyFallback(): void {
    this.clearReadyFallback();
    this.readyFallbackTimer = setTimeout(() => {
      this.readyFallbackTimer = null;
      if (this.state !== 'authenticating') return;
      logger.warn(
        { afterMs: READY_FALLBACK_MS },
        'ready nunca llego; se asume sesion usable (workaround wwebjs)',
      );
      this.setState('online', { readyFallback: true });
    }, READY_FALLBACK_MS);
  }

  private clearReadyFallback(): void {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
  }

  private setState(s: SessionState, meta?: Record<string, unknown>) {
    this.state = s;
    for (const h of this.stateHandlers) h(s, meta);
  }

  getSessionState(): SessionState {
    return this.state;
  }

  getQrCode(): string | null {
    return this.qr;
  }

  async start(): Promise<void> {
    await this.client.initialize();
    this.startKeepalive();
  }

  async stop(): Promise<void> {
    this.stopKeepalive();
    await this.client.destroy();
  }

  /**
   * Ping ligero cada 2 min al runtime de WhatsApp Web para mantener la pagina
   * de Puppeteer activa. Sin esto, despues de ~1h idle, el primer mensaje
   * outbound tira "detached frame" y el supervisor tiene que respawnear.
   * `getState` no manda nada a WhatsApp — solo ejecuta JS en la pagina.
   */
  private keepaliveTimer: NodeJS.Timeout | null = null;

  private startKeepalive(): void {
    if (this.keepaliveTimer) return;
    const intervalMs = 120_000;
    this.keepaliveTimer = setInterval(() => {
      if (this.state !== 'online') return;
      this.client
        .getState()
        .then((s) => logger.debug({ waState: s }, 'keepalive ok'))
        .catch((err) => logger.warn({ err: String(err) }, 'keepalive failed'));
    }, intervalMs);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  onIncoming(handler: IncomingMessageHandler): void {
    this.incomingHandlers.push(handler);
  }

  onSessionStateChange(handler: SessionStateHandler): void {
    this.stateHandlers.push(handler);
  }

  async send(to: string, message: OutgoingMessage): Promise<SendResult> {
    // Espaciado aleatorio para mitigar baneo (500-1500ms)
    await sleep(500 + Math.floor(Math.random() * 1000));

    const chatId = toChatId(to);
    const doSend = async (): Promise<pkg.Message> => {
      if (
        message.mediaUrl &&
        (message.contentType === 'image' || message.contentType === 'video')
      ) {
        const media = await MessageMedia.fromUrl(message.mediaUrl, { unsafeMime: true });
        return this.client.sendMessage(chatId, media, { caption: message.caption });
      }
      if (message.text) {
        return this.client.sendMessage(chatId, message.text);
      }
      throw new Error('OutgoingMessage sin contenido');
    };

    try {
      const sent = await doSend();
      // whatsapp-web.js >=1.34.6 devuelve `undefined` aunque el mensaje SI se entrega
      // (verificado en produccion 2026-08-03: llega al telefono con retorno undefined).
      // Es secuela de la migracion de WhatsApp a LID. Un fallo real de envio lanza
      // excepcion y cae en el catch, asi que un retorno vacio se trata como entregado
      // con un id no confirmado — antes se marcaba como fallido y el historial mentia.
      if (!sent?.id?._serialized) {
        logger.warn('sendMessage devolvio vacio; se asume entregado con id no confirmado');
        return { externalId: `unconfirmed-${randomUUID()}`, sentAt: new Date() };
      }
      return {
        externalId: sent.id._serialized,
        sentAt: new Date(sent.timestamp * 1000),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isDetached = /detached frame|Execution context was destroyed|Target closed/i.test(
        msg,
      );
      if (!isDetached) throw err;

      // Retry con delay — detached frame suele ser transiente si esperamos
      // suficiente. Hacemos un getState() previo al retry para forzar el
      // re-attach de Puppeteer antes de intentar otra vez.
      logger.warn({ err: msg }, 'send detached frame, retry en 5s');
      await sleep(5000);
      try {
        await this.client.getState().catch(() => undefined);
        const sent = await doSend();
        if (!sent?.id?._serialized) {
          return { externalId: `unconfirmed-${randomUUID()}`, sentAt: new Date() };
        }
        return {
          externalId: sent.id._serialized,
          sentAt: new Date(sent.timestamp * 1000),
        };
      } catch (err2) {
        // Persistente: el cliente Puppeteer esta wedged. Exit para que el supervisor
        // haga clean-respawn (destroy+init inline no libera el SingletonLock a tiempo).
        logger.error(
          { err: err2 instanceof Error ? err2.message : String(err2) },
          'detached frame persistente, exit(1) → supervisor respawnea',
        );
        this.requestRespawn('send_detached_persistent');
        throw err2;
      }
    }
  }

  /** Sale del proceso para que el supervisor haga clean-respawn. Es idempotente. */
  private respawnRequested = false;

  private requestRespawn(reason: string): void {
    if (this.respawnRequested) return;
    this.respawnRequested = true;
    this.setState('offline', { reason });
    // Damos 500ms para que logs/heartbeat terminen de salir
    setTimeout(() => process.exit(1), 500);
  }

  /** Reinit publico llamado por SSE command "reinit". Exit-then-respawn. */
  reinit(): void {
    logger.warn('reinit solicitado (SSE command) → exit para respawn');
    this.requestRespawn('reinit_command');
  }

  private async handleIncoming(raw: pkg.Message): Promise<void> {
    // Filtro: ignorar grupos (bot es 1-a-1)
    if (raw.from.endsWith('@g.us')) return;
    // Filtro: ignorar mensajes del propio bot
    if (raw.fromMe) return;

    // DIAGNOSTICO TEMPORAL — forma real de id/from y resolucion del telefono (LID).
    try {
      const contact = await raw.getContact();
      logger.warn(
        {
          diag: 'incoming-shape',
          rawFrom: raw.from,
          idKeys: raw.id ? Object.keys(raw.id) : null,
          idSerialized: raw.id?._serialized ?? null,
          idRemote: (raw.id as { remote?: unknown })?.remote ?? null,
          contactNumber: contact?.number ?? null,
          contactIdUser: contact?.id?.user ?? null,
          contactIdServer: contact?.id?.server ?? null,
        },
        'DIAG incoming',
      );
    } catch (e) {
      logger.warn({ diag: 'incoming-shape-failed', err: String(e) }, 'DIAG incoming fallo');
    }

    const incoming: IncomingMessage = {
      externalId: raw.id._serialized,
      from: fromChatId(raw.from),
      receivedAt: new Date(raw.timestamp * 1000),
      contentType: mapContentType(raw.type),
      text: raw.body || undefined,
      isGroup: false,
    };

    for (const h of this.incomingHandlers) {
      await h(incoming);
    }
  }
}

function toChatId(phoneE164: string): string {
  // +573001234567 -> 573001234567@c.us
  const digits = phoneE164.replace(/^\+/, '');
  return `${digits}@c.us`;
}

function fromChatId(chatId: string): string {
  const digits = chatId.replace(/@c\.us$/, '');
  return `+${digits}`;
}

function mapContentType(waType: string): IncomingMessage['contentType'] {
  switch (waType) {
    case 'chat':
      return 'text';
    case 'image':
      return 'image';
    case 'audio':
    case 'ptt':
      return 'audio';
    case 'video':
      return 'video';
    case 'sticker':
      return 'sticker';
    case 'document':
      return 'document';
    default:
      return 'unknown';
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
