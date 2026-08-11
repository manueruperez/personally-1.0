import { describe, expect, it } from 'vitest';
import { KeywordIntentClassifier } from './keyword-classifier.js';

const clf = new KeywordIntentClassifier();

describe('KeywordIntentClassifier', () => {
  describe('START', () => {
    it('detecta "iniciar" en estado greeted', async () => {
      const r = await clf.classify('iniciar', { sessionState: 'greeted' });
      expect(r.intent).toBe('START');
      expect(r.confidence).toBe(1);
    });

    it('detecta "empezar" / "vamos"', async () => {
      expect((await clf.classify('empezar', { sessionState: 'greeted' })).intent).toBe('START');
      expect((await clf.classify('vamos', { sessionState: 'greeted' })).intent).toBe('START');
    });

    it('NO detecta START fuera de greeted', async () => {
      const r = await clf.classify('iniciar', { sessionState: 'in_exercise' });
      expect(r.intent).not.toBe('START');
    });
  });

  describe('NEXT', () => {
    it('detecta "siguiente"', async () => {
      expect((await clf.classify('siguiente')).intent).toBe('NEXT');
    });

    it('detecta variantes coloquiales', async () => {
      expect((await clf.classify('listo')).intent).toBe('NEXT');
      expect((await clf.classify('ok')).intent).toBe('NEXT');
      expect((await clf.classify('ya')).intent).toBe('NEXT');
      expect((await clf.classify('hecho')).intent).toBe('NEXT');
    });

    it('case-insensitive + tildes', async () => {
      expect((await clf.classify('SIGUIENTE')).intent).toBe('NEXT');
      expect((await clf.classify('Listó')).intent).toBe('NEXT');
    });
  });

  describe('SKIP', () => {
    it('detecta "saltar" / "pasar"', async () => {
      expect((await clf.classify('saltar')).intent).toBe('SKIP');
      expect((await clf.classify('pasar')).intent).toBe('SKIP');
    });

    it('frase multi-palabra', async () => {
      expect((await clf.classify('no puedo hacer este')).intent).toBe('SKIP');
    });
  });

  describe('CHANGE', () => {
    it('detecta "cambiar" / "otro" / "alternativa"', async () => {
      expect((await clf.classify('cambiar')).intent).toBe('CHANGE');
      expect((await clf.classify('otro ejercicio')).intent).toBe('CHANGE');
      expect((await clf.classify('alternativa')).intent).toBe('CHANGE');
    });
  });

  describe('PAIN', () => {
    it('detecta variantes', async () => {
      expect((await clf.classify('me duele la rodilla')).intent).toBe('PAIN');
      expect((await clf.classify('siento dolor')).intent).toBe('PAIN');
      expect((await clf.classify('me lesione')).intent).toBe('PAIN');
      expect((await clf.classify('molestia')).intent).toBe('PAIN');
    });

    it('PAIN tiene prioridad sobre otros intents', async () => {
      // "me duele pero sigo" → PAIN, no NEXT
      const r = await clf.classify('me duele');
      expect(r.intent).toBe('PAIN');
    });
  });

  describe('FINISH', () => {
    it('detecta "finalizar" / "fin"', async () => {
      expect((await clf.classify('finalizar')).intent).toBe('FINISH');
      expect((await clf.classify('fin')).intent).toBe('FINISH');
      expect((await clf.classify('cerrar')).intent).toBe('FINISH');
    });
  });

  describe('UNKNOWN', () => {
    it('texto sin match', async () => {
      const r = await clf.classify('hola que tal');
      expect(r.intent).toBe('UNKNOWN');
      expect(r.confidence).toBe(0);
    });

    it('string vacio', async () => {
      expect((await clf.classify('')).intent).toBe('UNKNOWN');
    });
  });

  describe('priority', () => {
    it('PAIN > FINISH > CHANGE > SKIP > NEXT', async () => {
      // "termine de pasar el dolor" → deberia caer en PAIN (tiene prioridad)
      expect((await clf.classify('termine de pasar me duele')).intent).toBe('PAIN');
    });
  });
});

/**
 * La baja es irreversible desde el lado del cliente: lo deja sin su rutina
 * hasta que el entrenador lo reactive desde el panel. Por eso el riesgo grave
 * no es no detectarla, sino detectarla de mas — y en un contexto de
 * entrenamiento "baja" aparece todo el tiempo de forma inocente.
 */
describe('STOP: baja del cliente', () => {
  const c = new KeywordIntentClassifier();

  it.each(['baja', 'BAJA', 'Baja.', ' baja ', 'stop', 'cancelar', 'salir', 'unsubscribe'])(
    'detecta la baja cuando el mensaje completo es "%s"',
    async (text) => {
      expect((await c.classify(text)).intent).toBe('STOP');
    },
  );

  it.each([
    'quiero darme de baja',
    'no quiero recibir mas mensajes',
    'por favor dejar de recibir estos mensajes',
    'no me escribas mas',
  ])('detecta la baja en la frase "%s"', async (text) => {
    expect((await c.classify(text)).intent).toBe('STOP');
  });

  it.each([
    'baja el peso',
    'bajale a la carga',
    'bajo mucho el ritmo hoy',
    'hoy baje 2 kilos',
    'me cuesta bajar en la sentadilla',
  ])('NO da de baja por "%s"', async (text) => {
    expect((await c.classify(text)).intent).not.toBe('STOP');
  });

  it('gana sobre otras keywords que aparezcan en el mismo mensaje', async () => {
    expect((await c.classify('quiero darme de baja, listo')).intent).toBe('STOP');
  });

  it('no rompe los intents existentes', async () => {
    expect((await c.classify('siguiente')).intent).toBe('NEXT');
    expect((await c.classify('me duele el hombro')).intent).toBe('PAIN');
    expect((await c.classify('iniciar', { sessionState: 'greeted' })).intent).toBe('START');
  });
});
