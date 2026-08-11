import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * whatsapp-web.js se mockea porque instanciar el canal real levanta Puppeteer.
 * Aca solo importa QUE implementacion devuelve la fabrica, no su comportamiento.
 */
vi.mock('whatsapp-web.js', () => {
  class Client {
    on = vi.fn();
  }
  class LocalAuth {}
  class MessageMedia {}
  return { default: { Client, LocalAuth, MessageMedia } };
});

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { createChannel, resolveChannelKind } = await import('./factory.js');
const { CloudApiChannel } = await import('./cloud-api/channel.js');
const { WhatsAppWebJsChannel } = await import('./whatsapp-webjs.js');

type ApiClient = ConstructorParameters<typeof WhatsAppWebJsChannel>[0]['api'];

/** El canal no usa `api` al construirse: basta un stub. */
const api = {} as ApiClient;

function build(env: NodeJS.ProcessEnv) {
  return createChannel({ agentVersion: '0.1.0', api, env });
}

const cloudEnv = {
  CHANNEL: 'cloud',
  WHATSAPP_PHONE_NUMBER_ID: '111',
  WHATSAPP_ACCESS_TOKEN: 'TOKEN',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveChannelKind', () => {
  it('sin CHANNEL seteado usa wwebjs: un deploy viejo no cambia de comportamiento', () => {
    expect(resolveChannelKind({})).toBe('wwebjs');
  });

  it('acepta mayusculas y espacios', () => {
    expect(resolveChannelKind({ CHANNEL: ' Cloud ' })).toBe('cloud');
  });

  it('un valor invalido falla con mensaje claro en vez de caer al default', () => {
    expect(() => resolveChannelKind({ CHANNEL: 'telegram' })).toThrow(
      'CHANNEL invalido: "telegram". Valores validos: wwebjs | cloud',
    );
  });
});

describe('createChannel', () => {
  it('CHANNEL ausente devuelve el canal de whatsapp-web.js', () => {
    expect(build({})).toBeInstanceOf(WhatsAppWebJsChannel);
  });

  it('CHANNEL=cloud devuelve el canal de Cloud API', () => {
    expect(build(cloudEnv)).toBeInstanceOf(CloudApiChannel);
  });

  it('CHANNEL=cloud sin phone number id falla al arrancar, no al primer envio', () => {
    expect(() => build({ CHANNEL: 'cloud', WHATSAPP_ACCESS_TOKEN: 'T' })).toThrow(
      'CHANNEL=cloud requiere WHATSAPP_PHONE_NUMBER_ID en el .env',
    );
  });

  it('CHANNEL=cloud sin token falla al arrancar', () => {
    expect(() => build({ CHANNEL: 'cloud', WHATSAPP_PHONE_NUMBER_ID: '111' })).toThrow(
      'CHANNEL=cloud requiere WHATSAPP_ACCESS_TOKEN en el .env',
    );
  });

  it('lista las dos variables cuando faltan ambas', () => {
    expect(() => build({ CHANNEL: 'cloud' })).toThrow(
      'CHANNEL=cloud requiere WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en el .env',
    );
  });
});
