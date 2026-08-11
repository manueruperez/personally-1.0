import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendTextMock = vi.fn();
const sendImageMock = vi.fn();
const sendTemplateMock = vi.fn();

vi.mock('./client.js', () => ({
  sendText: (...a: unknown[]) => sendTextMock(...a),
  sendImage: (...a: unknown[]) => sendImageMock(...a),
  sendTemplate: (...a: unknown[]) => sendTemplateMock(...a),
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { CloudApiChannel } = await import('./channel.js');

function makeChannel() {
  return new CloudApiChannel({ phoneNumberId: '111', accessToken: 'T' });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendTextMock.mockResolvedValue('wamid.TEXT');
  sendImageMock.mockResolvedValue('wamid.IMG');
  sendTemplateMock.mockResolvedValue('wamid.TPL');
});

describe('estado del canal', () => {
  it('siempre esta online: no hay sesion que caerse', async () => {
    const ch = makeChannel();
    expect(ch.getSessionState()).toBe('online');
    await ch.start();
    expect(ch.getSessionState()).toBe('online');
  });

  it('nunca pide QR', () => {
    expect(makeChannel().getQrCode()).toBeNull();
  });

  it('start notifica online para que el heartbeat lo reporte', async () => {
    const ch = makeChannel();
    const onState = vi.fn();
    ch.onSessionStateChange(onState);

    await ch.start();

    expect(onState).toHaveBeenCalledWith('online');
  });

  it('stop no rompe aunque no haya conexion abierta', async () => {
    await expect(makeChannel().stop()).resolves.toBeUndefined();
  });
});

describe('send: ruteo por contentType', () => {
  it('texto plano va como mensaje de sesion', async () => {
    await makeChannel().send('+573001234567', { contentType: 'text', text: 'siguiente' });

    expect(sendTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumberId: '111' }),
      '+573001234567',
      'siguiente',
    );
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it('imagen con caption va como image', async () => {
    await makeChannel().send('+573001234567', {
      contentType: 'image',
      mediaUrl: 'https://cdn.test/x.jpg',
      caption: 'Sentadilla 3x12',
      templateKey: 'exercise_card',
    });

    expect(sendImageMock).toHaveBeenCalledWith(
      expect.anything(),
      '+573001234567',
      'https://cdn.test/x.jpg',
      'Sentadilla 3x12',
    );
  });

  it('exercise_card sin imagen cae a texto, no a plantilla', async () => {
    await makeChannel().send('+573001234567', {
      contentType: 'text',
      text: 'Sentadilla 3x12',
      templateKey: 'exercise_card',
    });

    expect(sendTextMock).toHaveBeenCalled();
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it('sin texto ni media lanza error explicito', async () => {
    await expect(
      makeChannel().send('+573001234567', { contentType: 'text' }),
    ).rejects.toThrow('OutgoingMessage sin contenido');
  });
});

describe('send: plantillas', () => {
  const saludo = {
    contentType: 'text' as const,
    text: '¡Hola Juan! 💪\nHoy: Pierna',
    templateKey: 'greeting',
    templateParams: ['Juan', 'Pierna', '~45 min · 6 ejercicios'],
  };

  it('el saludo diario sale como plantilla con sus variables en orden', async () => {
    await makeChannel().send('+573001234567', saludo);

    expect(sendTemplateMock).toHaveBeenCalledWith(
      expect.anything(),
      '+573001234567',
      'greeting',
      'es',
      ['Juan', 'Pierna', '~45 min · 6 ejercicios'],
    );
    expect(sendTextMock).not.toHaveBeenCalled();
  });

  it('no manda el texto ya renderizado como variable', async () => {
    await makeChannel().send('+573001234567', saludo);

    const params = sendTemplateMock.mock.calls[0][4] as string[];
    expect(params).not.toContain(saludo.text);
  });

  it('respeta el idioma de plantilla configurado', async () => {
    const ch = new CloudApiChannel({
      phoneNumberId: '111',
      accessToken: 'T',
      templateLanguage: 'es_CO',
    });

    await ch.send('+573001234567', saludo);

    expect(sendTemplateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'greeting',
      'es_CO',
      expect.anything(),
    );
  });

  /**
   * Un desajuste de variables da 400 en Meta y el mensaje se pierde; el error
   * que devuelve no aclara cual de las dos puntas quedo mal. Se corta antes.
   */
  it('falla con mensaje claro si faltan variables, sin llamar a Meta', async () => {
    await expect(
      makeChannel().send('+573001234567', {
        contentType: 'text',
        text: 'hola',
        templateKey: 'greeting',
        templateParams: ['Juan'],
      }),
    ).rejects.toThrow('plantilla greeting: se esperaban 3 variables y llegaron 1');

    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it('falla si el mensaje viene sin variables (mensaje viejo en la cola)', async () => {
    await expect(
      makeChannel().send('+573001234567', {
        contentType: 'text',
        text: 'hola',
        templateKey: 'greeting',
      }),
    ).rejects.toThrow('se esperaban 3 variables y llegaron 0');

    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it('falla si sobran variables', async () => {
    await expect(
      makeChannel().send('+573001234567', {
        contentType: 'text',
        text: 'hola',
        templateKey: 'greeting',
        templateParams: ['a', 'b', 'c', 'd'],
      }),
    ).rejects.toThrow('llegaron 4');
  });
});

describe('SendResult', () => {
  it('externalId sale del wamid que devuelve Meta', async () => {
    sendTextMock.mockResolvedValue('wamid.HBgMNTcz');

    const res = await makeChannel().send('+573001234567', { contentType: 'text', text: 'hola' });

    expect(res.externalId).toBe('wamid.HBgMNTcz');
    expect(res.sentAt).toBeInstanceOf(Date);
  });

  it('un error del cliente se propaga y no inventa una entrega', async () => {
    sendTextMock.mockRejectedValue(new Error('Rate limit hit'));

    await expect(
      makeChannel().send('+573001234567', { contentType: 'text', text: 'hola' }),
    ).rejects.toThrow('Rate limit hit');
  });
});
