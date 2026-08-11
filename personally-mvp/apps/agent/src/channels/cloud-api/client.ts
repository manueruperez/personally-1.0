/**
 * Cliente HTTP de la WhatsApp Cloud API (Graph API de Meta).
 *
 * Funciones puras sobre `fetch`, sin estado ni sesion: la credencial es un token
 * permanente de System User. Ver planes-dev/2026-08-05-migracion-whatsapp-cloud-api.
 */

/**
 * Version de la Graph API. Meta soporta cada version ~2 años.
 * Alineada con la que genera el panel de Meta (verificado 2026-08-10).
 */
export const GRAPH_API_VERSION = 'v25.0';

export interface CloudApiConfig {
  phoneNumberId: string;
  accessToken: string;
  /** Override para tests. Default: https://graph.facebook.com */
  baseUrl?: string;
}

/**
 * Error de la Cloud API con el detalle que devuelve Meta.
 *
 * `retryable` distingue lo que tiene sentido reintentar (429 rate limit, 5xx)
 * de lo que no (400 payload invalido, 401 token vencido): el outbox worker
 * marca como fallido definitivo solo lo segundo.
 */
export class CloudApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = 'CloudApiError';
    this.status = status;
    this.code = code;
    this.retryable = status === 429 || status >= 500;
  }
}

/** Variable de una plantilla, en el orden en que Meta las numera ({{1}}, {{2}}...). */
export type TemplateParam = string;

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_data?: { details?: string } };
}

interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
}

function endpoint(cfg: CloudApiConfig): string {
  const base = cfg.baseUrl ?? 'https://graph.facebook.com';
  return `${base}/${GRAPH_API_VERSION}/${cfg.phoneNumberId}/messages`;
}

/**
 * Destinatario en el formato que espera Meta: E.164 sin `+`.
 * La Cloud API acepta ambos, pero normalizamos para que los payloads sean
 * comparables en logs y tests.
 */
function toRecipient(phoneE164: string): string {
  return phoneE164.replace(/^\+/, '');
}

/**
 * POST al endpoint de mensajes. Devuelve el `wamid` del mensaje creado.
 *
 * Meta responde 200 con `{ messages: [{ id: "wamid.XXX" }] }`. Cualquier otra
 * cosa es error: a diferencia de whatsapp-web.js, aca un 200 sin id no ocurre,
 * asi que lo tratamos como respuesta corrupta en vez de asumir entrega.
 */
async function post(cfg: CloudApiConfig, payload: Record<string, unknown>): Promise<string> {
  const res = await fetch(endpoint(cfg), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as MetaErrorBody;
    const detail = body.error?.error_data?.details;
    const message = body.error?.message ?? `HTTP ${res.status}`;
    throw new CloudApiError(
      detail ? `${message} (${detail})` : message,
      res.status,
      body.error?.code,
    );
  }

  const body = (await res.json()) as MetaSendResponse;
  const wamid = body.messages?.[0]?.id;
  if (!wamid) {
    throw new CloudApiError('respuesta 200 sin wamid', res.status);
  }
  return wamid;
}

/** Mensaje de texto libre. Solo valido dentro de la ventana de 24h. */
export async function sendText(
  cfg: CloudApiConfig,
  to: string,
  text: string,
): Promise<string> {
  return post(cfg, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toRecipient(to),
    type: 'text',
    // Sin preview: los textos del bot no llevan links y el preview cambia el layout.
    text: { body: text, preview_url: false },
  });
}

/**
 * Imagen por URL publica: Meta la descarga por su cuenta, no subimos bytes.
 * La URL tiene que ser accesible sin auth y servir un Content-Type de imagen.
 */
export async function sendImage(
  cfg: CloudApiConfig,
  to: string,
  link: string,
  caption?: string,
): Promise<string> {
  return post(cfg, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toRecipient(to),
    type: 'image',
    image: caption ? { link, caption } : { link },
  });
}

/**
 * Plantilla pre-aprobada. Es el unico tipo que se puede mandar FUERA de la
 * ventana de 24h — por eso el saludo diario va por aca.
 *
 * `params` van en el orden de los placeholders {{1}}, {{2}}... de la plantilla
 * registrada en Meta; si no coinciden en cantidad, Meta responde 400.
 */
export async function sendTemplate(
  cfg: CloudApiConfig,
  to: string,
  templateName: string,
  languageCode: string,
  params: TemplateParam[] = [],
): Promise<string> {
  const components =
    params.length > 0
      ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }]
      : undefined;

  return post(cfg, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toRecipient(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}
