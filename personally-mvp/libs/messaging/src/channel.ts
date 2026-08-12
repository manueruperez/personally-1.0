import type { ContentType } from '@personally/types';

/**
 * Estado del canal de mensajeria (no confundir con sesion de entrenamiento).
 *
 * Se quedo sin `qr_required`, `authenticating` ni `reconnecting`: describian una
 * sesion de WhatsApp Web que habia que vincular y podia caerse. Con la Cloud API
 * la credencial es un token permanente, asi que el canal solo puede estar arriba
 * o abajo. `initializing` sobrevive para el canal que venga (uno con handshake
 * real arranca ahi antes de llegar a `online`).
 */
export type SessionState = 'initializing' | 'online' | 'offline';

export interface OutgoingMessage {
  contentType: ContentType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  templateKey?: string;
  /**
   * Variables de la plantilla, en el orden de los placeholders {{1}}, {{2}}...
   *
   * Solo lo usan los canales que mandan plantillas de verdad (Cloud API). Los
   * canales que mandan texto libre ignoran esto y usan `text`, que ya viene
   * renderizado — asi el mismo mensaje sirve para los dos.
   */
  templateParams?: string[];
}

export interface IncomingMessage {
  externalId: string;
  from: string; // numero E.164 o id del canal
  receivedAt: Date;
  contentType: ContentType;
  text?: string;
  mediaUrl?: string;
  isGroup: boolean;
}

export interface SendResult {
  externalId: string;
  sentAt: Date;
}

export type IncomingMessageHandler = (msg: IncomingMessage) => void | Promise<void>;
export type SessionStateHandler = (state: SessionState, meta?: Record<string, unknown>) => void;

/**
 * Abstraccion de canal de mensajeria.
 * Implementacion activa: CloudApiChannel (WhatsApp Cloud API de Meta). La
 * interfaz es lo que hizo barata la migracion desde whatsapp-web.js, asi que
 * se conserva para el proximo canal (Telegram, otro BSP).
 */
export interface MessagingChannel {
  /** Inicia la conexion al canal. Resuelve cuando esta `online`. */
  start(): Promise<void>;

  /** Cierra la conexion limpiamente. */
  stop(): Promise<void>;

  /** Envia un mensaje a un destinatario. */
  send(to: string, message: OutgoingMessage): Promise<SendResult>;

  /** Registra un handler para mensajes entrantes. */
  onIncoming(handler: IncomingMessageHandler): void;

  /** Registra un handler para cambios de estado del canal. */
  onSessionStateChange(handler: SessionStateHandler): void;

  /** Estado actual del canal. */
  getSessionState(): SessionState;
}
