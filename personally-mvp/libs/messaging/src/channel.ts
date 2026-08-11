import type { ContentType } from '@personally/types';

/**
 * Estado del canal de mensajeria (no confundir con sesion de entrenamiento).
 * Ver specs/bots/01-agente-whatsapp.md §2.
 */
export type SessionState =
  | 'initializing'
  | 'qr_required'
  | 'authenticating'
  | 'online'
  | 'reconnecting'
  | 'offline';

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
 * Implementaciones: WhatsAppWebJsChannel (MVP), TelegramChannel (Plan B),
 * WhatsAppCloudApiChannel (post-beta).
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

  /** QR code en base64 si el estado es qr_required; null en otro caso. */
  getQrCode(): string | null;
}
