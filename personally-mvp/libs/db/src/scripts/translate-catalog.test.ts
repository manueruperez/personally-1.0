import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from './translate-catalog.js';

describe('translate-catalog TRANSLATIONS', () => {
  it('todas las claves están en minúsculas (match case-insensitive)', () => {
    for (const key of Object.keys(TRANSLATIONS)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('ningún valor está vacío', () => {
    for (const [key, value] of Object.entries(TRANSLATIONS)) {
      expect(value.trim(), `clave "${key}" tiene valor vacío`).not.toBe('');
    }
  });

  it('al menos la mitad de los valores son realmente distintos a la clave', () => {
    // Algunos términos son loanwords válidos en uso real de trainers ES (burpee,
    // hack squat, pallof press, dead bug, bird dog). Pero el bulk debería ser
    // traducción real para justificar el script.
    const entries = Object.entries(TRANSLATIONS);
    const actuallyTranslated = entries.filter(
      ([k, v]) => v.toLowerCase() !== k.toLowerCase(),
    );
    expect(actuallyTranslated.length).toBeGreaterThan(entries.length / 2);
  });

  it('incluye los compound lifts esenciales', () => {
    const essentials = ['squat', 'deadlift', 'bench press', 'overhead press'];
    for (const e of essentials) {
      expect(TRANSLATIONS[e], `falta traducción de "${e}"`).toBeDefined();
    }
  });

  it('cubre al menos 50 ejercicios', () => {
    expect(Object.keys(TRANSLATIONS).length).toBeGreaterThanOrEqual(50);
  });
});
