import type { ContentType } from '@personally/types';

/**
 * Mensaje entrante ya normalizado desde el payload de Meta al shape que
 * consume `processIncomingMessage`.
 */
export interface NormalizedIncoming {
  phone: string;
  externalId: string;
  receivedAt: Date;
  contentType: ContentType;
  contentText?: string;
}

/**
 * Extrae los mensajes de un webhook de la Cloud API.
 *
 * Meta manda el mismo endpoint para mensajes y para acuses (`statuses`:
 * sent/delivered/read). Los acuses se ignoran en silencio — llegan varios por
 * cada mensaje que mandamos y no aportan nada al flujo de la rutina.
 *
 * Un webhook puede traer varias entries y varios mensajes por entry, asi que
 * siempre devuelve una lista.
 */
export function normalizeWebhookPayload(body: unknown): NormalizedIncoming[] {
  const root = body as {
    object?: string;
    entry?: Array<{ changes?: Array<{ field?: string; value?: MetaChangeValue }> }>;
  };

  if (root?.object !== 'whatsapp_business_account') return [];

  const out: NormalizedIncoming[] = [];

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const raw of change.value?.messages ?? []) {
        const normalized = normalizeMessage(raw);
        if (normalized) out.push(normalized);
      }
    }
  }

  return out;
}

interface MetaChangeValue {
  messages?: MetaMessage[];
  statuses?: unknown[];
}

interface MetaMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string };
}

function normalizeMessage(raw: MetaMessage): NormalizedIncoming | null {
  // Sin remitente o sin id no hay nada que persistir ni con que deduplicar.
  if (!raw.from || !raw.id) return null;

  return {
    // Meta manda el numero sin `+`; la DB guarda E.164 con `+`.
    phone: `+${raw.from.replace(/^\+/, '')}`,
    externalId: raw.id,
    receivedAt: parseTimestamp(raw.timestamp),
    contentType: mapContentType(raw.type),
    contentText: extractText(raw),
  };
}

/** Meta manda epoch en segundos como string. */
function parseTimestamp(ts?: string): Date {
  const seconds = Number(ts);
  if (!ts || Number.isNaN(seconds)) return new Date();
  return new Date(seconds * 1000);
}

/**
 * Texto sobre el que corre el NLU.
 *
 * Los botones y listas interactivas traen el texto en otra rama del payload;
 * mapearlos al mismo campo deja el clasificador por keywords funcionando sin
 * cambios si algun dia agregamos botones.
 */
function extractText(raw: MetaMessage): string | undefined {
  return (
    raw.text?.body ??
    raw.button?.text ??
    raw.interactive?.button_reply?.title ??
    raw.interactive?.list_reply?.title ??
    raw.image?.caption ??
    raw.video?.caption ??
    raw.document?.caption ??
    undefined
  );
}

function mapContentType(metaType?: string): ContentType {
  switch (metaType) {
    case 'text':
    case 'button':
    case 'interactive':
      return 'text';
    case 'image':
      return 'image';
    case 'audio':
    case 'voice':
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
