import { describe, expect, it } from 'vitest';
import { createChannel } from './create-channel.js';
import { CloudApiChannel } from './cloud-api/channel.js';

function build(env: NodeJS.ProcessEnv) {
  return createChannel({ env });
}

const cloudEnv = {
  WHATSAPP_PHONE_NUMBER_ID: '111',
  WHATSAPP_ACCESS_TOKEN: 'TOKEN',
};

describe('createChannel', () => {
  it('devuelve el canal de Cloud API', () => {
    expect(build(cloudEnv)).toBeInstanceOf(CloudApiChannel);
  });

  it('sin phone number id falla al arrancar, no al primer envio', () => {
    expect(() => build({ WHATSAPP_ACCESS_TOKEN: 'T' })).toThrow(
      'el canal de WhatsApp requiere WHATSAPP_PHONE_NUMBER_ID en el .env',
    );
  });

  it('sin token falla al arrancar', () => {
    expect(() => build({ WHATSAPP_PHONE_NUMBER_ID: '111' })).toThrow(
      'el canal de WhatsApp requiere WHATSAPP_ACCESS_TOKEN en el .env',
    );
  });

  it('lista las dos variables cuando faltan ambas', () => {
    expect(() => build({})).toThrow(
      'el canal de WhatsApp requiere WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en el .env',
    );
  });

  it('un valor vacio cuenta como faltante (un .env a medio llenar no arranca)', () => {
    expect(() => build({ WHATSAPP_PHONE_NUMBER_ID: '', WHATSAPP_ACCESS_TOKEN: '' })).toThrow(
      'el canal de WhatsApp requiere WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en el .env',
    );
  });
});
