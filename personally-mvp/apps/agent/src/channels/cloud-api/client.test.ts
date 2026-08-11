import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloudApiError,
  GRAPH_API_VERSION,
  sendImage,
  sendText,
  sendTemplate,
} from './client.js';

const cfg = {
  phoneNumberId: '111222333',
  accessToken: 'TOKEN-XYZ',
  baseUrl: 'https://graph.test',
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Respuesta feliz de Meta. */
function okResponse(wamid = 'wamid.HBgMNTczMDAx') {
  return {
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: wamid }] }),
  };
}

/** Respuesta de error de Meta con su shape real. */
function errorResponse(status: number, code: number, message: string, details?: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message, code, ...(details ? { error_data: { details } } : {}) } }),
  };
}

/** Body JSON que se mando en la ultima llamada a fetch. */
function lastPayload(): Record<string, any> {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(init.body);
}

describe('endpoint y auth', () => {
  it('pega al endpoint de mensajes del phone number con el token en el header', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendText(cfg, '+573001234567', 'hola');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.test/${GRAPH_API_VERSION}/111222333/messages`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer TOKEN-XYZ');
    expect(init.headers['Content-Type']).toBe('application/json');
  });
});

describe('sendText', () => {
  it('manda el payload de texto con el destinatario sin +', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendText(cfg, '+573001234567', 'arrancamos');

    expect(lastPayload()).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '573001234567',
      type: 'text',
      text: { body: 'arrancamos', preview_url: false },
    });
  });

  it('devuelve el wamid que asigna Meta', async () => {
    fetchMock.mockResolvedValue(okResponse('wamid.ABC'));

    await expect(sendText(cfg, '+573001234567', 'hola')).resolves.toBe('wamid.ABC');
  });
});

describe('sendImage', () => {
  it('manda link y caption cuando hay caption', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendImage(cfg, '+573001234567', 'https://cdn.test/sentadilla.jpg', 'Sentadilla 3x12');

    expect(lastPayload().type).toBe('image');
    expect(lastPayload().image).toEqual({
      link: 'https://cdn.test/sentadilla.jpg',
      caption: 'Sentadilla 3x12',
    });
  });

  it('omite caption cuando no hay (Meta rechaza caption vacio)', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendImage(cfg, '+573001234567', 'https://cdn.test/x.jpg');

    expect(lastPayload().image).toEqual({ link: 'https://cdn.test/x.jpg' });
  });
});

describe('sendTemplate', () => {
  it('mapea los params a componentes body en orden', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendTemplate(cfg, '+573001234567', 'greeting', 'es', ['Juan', 'Pierna']);

    expect(lastPayload().template).toEqual({
      name: 'greeting',
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Juan' },
            { type: 'text', text: 'Pierna' },
          ],
        },
      ],
    });
  });

  it('omite components cuando la plantilla no tiene variables', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendTemplate(cfg, '+573001234567', 'greeting', 'es');

    expect(lastPayload().template).toEqual({ name: 'greeting', language: { code: 'es' } });
    expect(lastPayload().template.components).toBeUndefined();
  });
});

describe('errores', () => {
  it('un 429 se reporta como reintentable', async () => {
    fetchMock.mockResolvedValue(errorResponse(429, 130429, 'Rate limit hit'));

    const err = await sendText(cfg, '+573001234567', 'hola').catch((e) => e);

    expect(err).toBeInstanceOf(CloudApiError);
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(429);
    expect(err.code).toBe(130429);
  });

  it('un 5xx se reporta como reintentable', async () => {
    fetchMock.mockResolvedValue(errorResponse(503, 1, 'Service unavailable'));

    await expect(sendText(cfg, '+573001234567', 'hola')).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('un 400 de payload invalido NO es reintentable y propaga el detalle de Meta', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(400, 132000, 'Template param count mismatch', 'expected 2, got 1'),
    );

    const err = await sendTemplate(cfg, '+573001234567', 'greeting', 'es', ['Juan']).catch(
      (e) => e,
    );

    expect(err.retryable).toBe(false);
    expect(err.message).toBe('Template param count mismatch (expected 2, got 1)');
  });

  it('un 401 por token vencido NO es reintentable', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 190, 'Access token has expired'));

    await expect(sendText(cfg, '+573001234567', 'hola')).rejects.toMatchObject({
      retryable: false,
      status: 401,
    });
  });

  it('un 200 sin wamid se trata como error, no como entrega', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ messages: [] }) });

    await expect(sendText(cfg, '+573001234567', 'hola')).rejects.toThrow('respuesta 200 sin wamid');
  });
});
