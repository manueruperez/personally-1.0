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
