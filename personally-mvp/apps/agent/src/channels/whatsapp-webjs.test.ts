import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * whatsapp-web.js >=1.34.6 entrega el mensaje pero devuelve `undefined` desde
 * `sendMessage` (secuela de la migracion de WhatsApp a LID, verificado en
 * produccion 2026-08-03). Estos tests fijan el contrato de `send()` para que un
 * retorno vacio NO se reporte como fallo — antes tiraba TypeError y el historial
 * marcaba como fallidos mensajes que el cliente si habia recibido.
 */

const sendMessageMock = vi.fn();
const clientOnMock = vi.fn();

/** Dispara el handler que el canal registro para un evento del cliente. */
function emit(event: string, ...args: unknown[]): void {
  for (const [name, handler] of clientOnMock.mock.calls as [string, (...a: unknown[]) => void][]) {
    if (name === event) handler(...args);
  }
}

vi.mock('whatsapp-web.js', () => {
  class Client {
    on = clientOnMock;
    sendMessage = sendMessageMock;
    getState = vi.fn().mockResolvedValue('CONNECTED');
  }
  class LocalAuth {}
  class MessageMedia {
    static fromUrl = vi.fn();
  }
  return { default: { Client, LocalAuth, MessageMedia } };
});

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { WhatsAppWebJsChannel } = await import('./whatsapp-webjs.js');
type ApiClient = ConstructorParameters<typeof WhatsAppWebJsChannel>[0]['api'];

function makeChannel() {
  // `api` es obligatorio en las opciones pero el canal no lo invoca: basta un stub.
  const api = {} as ApiClient;
  return new WhatsAppWebJsChannel({ agentVersion: '0.1.0', api, dataPath: '/tmp/wwebjs-test' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WhatsAppWebJsChannel.send', () => {
  it('usa el id real de WhatsApp cuando sendMessage devuelve el mensaje', async () => {
    sendMessageMock.mockResolvedValue({
      id: { _serialized: 'true_573001234567@c.us_ABC123' },
      timestamp: 1785800000,
    });

    const result = await makeChannel().send('+573001234567', {
      contentType: 'text',
      text: 'hola',
    });

    expect(result.externalId).toBe('true_573001234567@c.us_ABC123');
    expect(result.sentAt).toEqual(new Date(1785800000 * 1000));
  });

  it('no falla cuando sendMessage devuelve undefined: lo trata como entregado', async () => {
    sendMessageMock.mockResolvedValue(undefined);

    const result = await makeChannel().send('+573001234567', {
      contentType: 'text',
      text: 'hola',
    });

    expect(result.externalId).toMatch(/^unconfirmed-/);
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it('tambien tolera un mensaje sin id serializado', async () => {
    sendMessageMock.mockResolvedValue({ id: {}, timestamp: 1785800000 });

    const result = await makeChannel().send('+573001234567', {
      contentType: 'text',
      text: 'hola',
    });

    expect(result.externalId).toMatch(/^unconfirmed-/);
  });

  it('propaga un fallo real de envio (excepcion) en vez de darlo por entregado', async () => {
    sendMessageMock.mockRejectedValue(new Error('network down'));

    await expect(
      makeChannel().send('+573001234567', { contentType: 'text', text: 'hola' }),
    ).rejects.toThrow('network down');
  });

  it('cada envio no confirmado genera un externalId distinto', async () => {
    sendMessageMock.mockResolvedValue(undefined);
    const channel = makeChannel();

    const a = await channel.send('+573001234567', { contentType: 'text', text: 'uno' });
    const b = await channel.send('+573001234567', { contentType: 'text', text: 'dos' });

    expect(a.externalId).not.toBe(b.externalId);
  });
});

/**
 * Con LID, `msg.from` llega como `<id>@lid`, `msg.id._serialized` viene vacio
 * (el API rechazaba con 422 y el bot quedaba mudo) y `contact.number` devuelve
 * el LID en vez del telefono. El numero real esta en `contact.id.user`.
 */
describe('mensajes entrantes con LID', () => {
  function incomingMessage(over: Record<string, unknown> = {}) {
    return {
      from: '75548575404077@lid',
      fromMe: false,
      timestamp: 1785970016,
      type: 'chat',
      body: 'iniciar',
      id: { fromMe: false, remote: '75548575404077@lid', id: 'ABC123' },
      // contact.number devuelve el LID — la trampa que rompia el mapeo
      getContact: async () => ({
        number: '75548575404077',
        id: { user: '573177807831', server: 'c.us' },
      }),
      ...over,
    };
  }

  async function captureIncoming(msg: unknown) {
    const channel = makeChannel();
    const received: unknown[] = [];
    channel.onIncoming(async (m) => {
      received.push(m);
    });
    emit('message', msg);
    await vi.waitFor(() => expect(received.length).toBeGreaterThan(0));
    return received[0] as { externalId: string; from: string; text?: string };
  }

  it('resuelve el telefono real desde contact.id.user, no desde el LID', async () => {
    const msg = await captureIncoming(incomingMessage());
    expect(msg.from).toBe('+573177807831');
    expect(msg.text).toBe('iniciar');
  });

  it('reconstruye el externalId cuando _serialized viene vacio', async () => {
    const msg = await captureIncoming(incomingMessage());
    expect(msg.externalId).toBe('false_75548575404077@lid_ABC123');
  });

  it('prefiere _serialized cuando WhatsApp si lo expone', async () => {
    const msg = await captureIncoming(
      incomingMessage({
        id: { fromMe: false, remote: 'x@lid', id: 'Z9', _serialized: 'false_x@lid_Z9' },
      }),
    );
    expect(msg.externalId).toBe('false_x@lid_Z9');
  });

  it('nunca entrega un externalId vacio aunque no haya partes de id', async () => {
    const msg = await captureIncoming(incomingMessage({ id: {} }));
    expect(msg.externalId).toMatch(/^incoming-/);
  });

  it('con chat clasico (@c.us) sigue tomando el telefono del from', async () => {
    const msg = await captureIncoming(
      incomingMessage({
        from: '573001234567@c.us',
        id: { fromMe: false, remote: '573001234567@c.us', id: 'Q1' },
      }),
    );
    expect(msg.from).toBe('+573001234567');
  });

  it('si el contacto no resuelve telefono, no rompe el flujo', async () => {
    const msg = await captureIncoming(
      incomingMessage({
        getContact: async () => ({ number: '75548575404077', id: { user: '755485', server: 'lid' } }),
      }),
    );
    expect(msg.externalId).toBeTruthy();
    expect(msg.from).toBe('+75548575404077@lid');
  });
});

/**
 * whatsapp-web.js 1.34.x dejo de emitir `ready` contra WhatsApp Web 2.3000.x.
 * El outbox solo drena en `online`, asi que sin respaldo la sesion queda
 * autenticada pero inservible.
 */
describe('respaldo cuando `ready` nunca llega', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('pasa a online tras el margen si solo hubo authenticated', () => {
    const channel = makeChannel();
    const states: string[] = [];
    channel.onSessionStateChange((s) => states.push(s));

    emit('authenticated');
    expect(states).toEqual(['authenticating']);

    vi.advanceTimersByTime(45_000);
    expect(states).toEqual(['authenticating', 'online']);
  });

  it('si `ready` llega a tiempo no emite online duplicado', () => {
    const channel = makeChannel();
    const states: string[] = [];
    channel.onSessionStateChange((s) => states.push(s));

    emit('authenticated');
    emit('ready');
    vi.advanceTimersByTime(60_000);

    expect(states).toEqual(['authenticating', 'online']);
  });

  it('no fuerza online si la sesion cayo mientras corria el margen', () => {
    const channel = makeChannel();
    const states: string[] = [];
    channel.onSessionStateChange((s) => states.push(s));

    emit('authenticated');
    emit('disconnected', 'LOGOUT');
    vi.advanceTimersByTime(60_000);

    expect(states).toEqual(['authenticating', 'offline']);
  });
});
