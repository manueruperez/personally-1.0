import { describe, expect, it } from 'vitest';
import { normalizeWebhookPayload } from './payload.js';

/** Envoltorio real de Meta: object → entry[] → changes[] → value. */
function envelope(value: unknown) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '102290129340398', changes: [{ field: 'messages', value }] }],
  };
}

function textMessage(overrides: Record<string, unknown> = {}) {
  return envelope({
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '15550001111', phone_number_id: '111222333' },
    contacts: [{ profile: { name: 'Juan' }, wa_id: '573001234567' }],
    messages: [
      {
        from: '573001234567',
        id: 'wamid.HBgMNTczMDAxMjM0NTY3',
        timestamp: '1785800000',
        type: 'text',
        text: { body: 'iniciar' },
        ...overrides,
      },
    ],
  });
}

describe('mensajes de texto', () => {
  it('normaliza el payload real de Meta', () => {
    const [msg] = normalizeWebhookPayload(textMessage());

    expect(msg).toEqual({
      phone: '+573001234567',
      externalId: 'wamid.HBgMNTczMDAxMjM0NTY3',
      receivedAt: new Date(1785800000 * 1000),
      contentType: 'text',
      contentText: 'iniciar',
    });
  });

  it('antepone + al telefono porque Meta lo manda sin el', () => {
    const [msg] = normalizeWebhookPayload(textMessage());

    expect(msg.phone).toBe('+573001234567');
  });

  it('interpreta el timestamp como epoch en segundos', () => {
    const [msg] = normalizeWebhookPayload(textMessage({ timestamp: '1700000000' }));

    expect(msg.receivedAt.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });
});

describe('acuses de entrega', () => {
  it('ignora los eventos de status sin romper', () => {
    const body = envelope({
      messaging_product: 'whatsapp',
      metadata: { phone_number_id: '111222333' },
      statuses: [
        {
          id: 'wamid.XYZ',
          status: 'delivered',
          timestamp: '1785800001',
          recipient_id: '573001234567',
        },
      ],
    });

    expect(normalizeWebhookPayload(body)).toEqual([]);
  });
});

describe('otros tipos de contenido', () => {
  it('una imagen con caption usa el caption como texto', () => {
    const [msg] = normalizeWebhookPayload(
      textMessage({ type: 'image', text: undefined, image: { id: '123', caption: 'listo jefe' } }),
    );

    expect(msg.contentType).toBe('image');
    expect(msg.contentText).toBe('listo jefe');
  });

  it('un audio se mapea a audio y sin texto', () => {
    const [msg] = normalizeWebhookPayload(
      textMessage({ type: 'audio', text: undefined, audio: { id: '123' } }),
    );

    expect(msg.contentType).toBe('audio');
    expect(msg.contentText).toBeUndefined();
  });

  it('una respuesta de boton interactivo entra como texto para el NLU', () => {
    const [msg] = normalizeWebhookPayload(
      textMessage({
        type: 'interactive',
        text: undefined,
        interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'siguiente' } },
      }),
    );

    expect(msg.contentType).toBe('text');
    expect(msg.contentText).toBe('siguiente');
  });

  it('un tipo desconocido no rompe y cae en unknown', () => {
    const [msg] = normalizeWebhookPayload(
      textMessage({ type: 'location', text: undefined, location: { latitude: 4, longitude: -74 } }),
    );

    expect(msg.contentType).toBe('unknown');
  });
});

describe('payloads defensivos', () => {
  it('ignora un object que no es whatsapp_business_account', () => {
    expect(normalizeWebhookPayload({ object: 'page', entry: [] })).toEqual([]);
  });

  it('tolera un cuerpo vacio', () => {
    expect(normalizeWebhookPayload({})).toEqual([]);
    expect(normalizeWebhookPayload(null)).toEqual([]);
  });

  it('descarta mensajes sin id porque no habria con que deduplicar', () => {
    const body = envelope({
      messages: [{ from: '573001234567', timestamp: '1785800000', type: 'text', text: { body: 'x' } }],
    });

    expect(normalizeWebhookPayload(body)).toEqual([]);
  });

  it('devuelve todos los mensajes cuando Meta agrupa varios en un webhook', () => {
    const body = envelope({
      messages: [
        { from: '573001111111', id: 'wamid.A', timestamp: '1785800000', type: 'text', text: { body: 'uno' } },
        { from: '573002222222', id: 'wamid.B', timestamp: '1785800001', type: 'text', text: { body: 'dos' } },
      ],
    });

    const msgs = normalizeWebhookPayload(body);

    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.contentText)).toEqual(['uno', 'dos']);
  });
});
