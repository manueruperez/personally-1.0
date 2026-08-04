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

function makeChannel() {
  return new WhatsAppWebJsChannel({ agentVersion: '0.1.0', dataPath: '/tmp/wwebjs-test' });
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
