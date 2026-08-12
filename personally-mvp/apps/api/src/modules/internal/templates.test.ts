import { describe, expect, it } from 'vitest';
import {
  buildDailyGreetingParams,
  renderDailyGreeting,
  renderExerciseCard,
  renderFinishMessage,
  TXT_NO_ACTIVE_PLAN,
  TXT_REST_DAY,
} from './templates.js';

describe('renderExerciseCard', () => {
  it('incluye numero/total, bloque, nombre y prescripcion', () => {
    const text = renderExerciseCard({
      order: 3,
      total: 8,
      block: 'exercise',
      name: 'Sentadilla',
      sets: 3,
      reps: '10',
      restSeconds: 90,
      rpeTarget: 7,
      cues: 'Espalda neutra',
    });
    expect(text).toContain('3/8');
    expect(text).toContain('🏋️ Ejercicio');
    expect(text).toContain('Sentadilla');
    expect(text).toContain('3x10');
    expect(text).toContain('Descanso: 90s');
    expect(text).toContain('RPE 7');
    expect(text).toContain('Espalda neutra');
    expect(text).toContain('Responde *siguiente*');
  });

  it('warmup muestra etiqueta correcta', () => {
    const text = renderExerciseCard({
      order: 1,
      total: 5,
      block: 'warmup',
      name: 'Movilidad',
      sets: null,
      reps: '8 min',
      restSeconds: null,
      rpeTarget: null,
      cues: null,
    });
    expect(text).toContain('🔥 Calentamiento');
    expect(text).toContain('Movilidad');
    expect(text).toContain('8 min');
  });

  it('cooldown muestra etiqueta correcta', () => {
    const text = renderExerciseCard({
      order: 5,
      total: 5,
      block: 'cooldown',
      name: 'Estiramiento',
      sets: null,
      reps: '5 min',
      restSeconds: null,
      rpeTarget: null,
      cues: null,
    });
    expect(text).toContain('🧘 Cooldown');
  });

  it('omite prescripcion si todo es null', () => {
    const text = renderExerciseCard({
      order: 1,
      total: 1,
      block: 'exercise',
      name: 'Ejercicio X',
      sets: null,
      reps: null,
      restSeconds: null,
      rpeTarget: null,
      cues: null,
    });
    expect(text).not.toContain('📋');
    expect(text).not.toContain('💡');
    expect(text).toContain('Ejercicio X');
  });

  it('reps sin sets muestra solo reps', () => {
    const text = renderExerciseCard({
      order: 1,
      total: 1,
      block: 'exercise',
      name: 'Plancha',
      sets: null,
      reps: '30s',
      restSeconds: null,
      rpeTarget: null,
      cues: null,
    });
    expect(text).toContain('📋 30s');
  });
});

describe('renderDailyGreeting', () => {
  it('saluda con nombre corto', () => {
    const text = renderDailyGreeting({
      name: 'Juan Manuel',
      focus: 'Fuerza Lower',
      durationMin: 45,
      exerciseCount: 6,
    });
    expect(text).toContain('Juan'); // primer nombre
    expect(text).not.toContain('Manuel');
    expect(text).toContain('Fuerza Lower');
    expect(text).toContain('45 min');
    expect(text).toContain('6 ejercicios');
    expect(text).toContain('Responde *iniciar*');
  });

  it('sin focus ni duracion usa los fallbacks, no deja huecos', () => {
    const text = renderDailyGreeting({
      name: 'Juan',
      focus: null,
      durationMin: null,
      exerciseCount: 0,
    });
    expect(text).toContain('Juan');
    expect(text).toContain('tu rutina del dia');
    expect(text).toContain('a tu ritmo');
    expect(text).toContain('Responde *iniciar*');
    expect(text).not.toMatch(/Enfoque del día: *$/m);
  });

  /**
   * El cuerpo fijo esta congelado por la aprobacion de Meta (2026-08-11):
   * cambiarlo exige otra revision de 24-48h. Este test es el candado — si
   * alguien edita el texto sin querer, falla antes de llegar a produccion.
   */
  it('coincide exactamente con el cuerpo de la plantilla aprobada', () => {
    const text = renderDailyGreeting({
      name: 'Juan Manuel Perez',
      focus: 'Pierna y core',
      durationMin: 45,
      exerciseCount: 6,
    });

    expect(text).toBe(
      [
        'Hola Juan, tu sesión de entrenamiento de hoy ya está disponible en tu plan.',
        '',
        '  Enfoque del día: Pierna y core',
        '  Duración estimada: ~45 min · 6 ejercicios',
        '',
        '  Responde *iniciar* para comenzar.',
      ].join('\n'),
    );
  });

  /**
   * Las dos formas del saludo tienen que decir lo mismo: `text` es el mensaje ya
   * renderizado que queda en el historial del panel, y `templateParams` son las
   * variables sueltas que la Cloud API mete en la plantilla. Si divergen, el
   * trainer lee una cosa en el panel y el cliente recibe otra en el telefono.
   */
  it('usa las mismas variables que se le mandan a la plantilla', () => {
    const ctx = {
      name: 'Ana Lopez',
      focus: 'Empuje',
      durationMin: 30,
      exerciseCount: 4,
    };

    const text = renderDailyGreeting(ctx);

    for (const param of buildDailyGreetingParams(ctx)) {
      expect(text).toContain(param);
    }
  });
});

describe('renderFinishMessage', () => {
  it('100% → elogio completo', () => {
    const text = renderFinishMessage({ name: 'Juan', completionRate: 1 });
    expect(text).toMatch(/bien hecho/i);
    expect(text).toContain('Juan');
  });

  it('≥50% → buen trabajo', () => {
    const text = renderFinishMessage({ name: 'Juan', completionRate: 0.7 });
    expect(text).toMatch(/buen trabajo/i);
  });

  it('<50% → cerrado mas seco', () => {
    const text = renderFinishMessage({ name: 'Juan', completionRate: 0.3 });
    expect(text).toMatch(/dia cerrado/i);
  });
});

describe('constantes de texto', () => {
  it('son strings no vacios', () => {
    expect(TXT_NO_ACTIVE_PLAN.length).toBeGreaterThan(0);
    expect(TXT_REST_DAY.length).toBeGreaterThan(0);
  });
});

/**
 * Meta rechaza el envio si una variable llega vacia o con saltos de linea, y el
 * 400 que devuelve no dice cual fue. Estos tests fijan ese contrato del lado
 * nuestro.
 */
describe('buildDailyGreetingParams', () => {
  const base = { name: 'Juan Manuel Perez', focus: 'Pierna', durationMin: 45, exerciseCount: 6 };

  it('devuelve exactamente las 3 variables de la plantilla aprobada', () => {
    expect(buildDailyGreetingParams(base)).toHaveLength(3);
  });

  it('usa solo el primer nombre, como el saludo de texto', () => {
    expect(buildDailyGreetingParams(base)[0]).toBe('Juan');
  });

  it('arma duracion y cantidad de ejercicios en una sola linea', () => {
    expect(buildDailyGreetingParams(base)[2]).toBe('~45 min · 6 ejercicios');
  });

  it('omite la duracion cuando el plan no la define', () => {
    expect(buildDailyGreetingParams({ ...base, durationMin: null })[2]).toBe('6 ejercicios');
  });

  it('omite los ejercicios cuando el dia no tiene bloque de ejercicio', () => {
    expect(buildDailyGreetingParams({ ...base, exerciseCount: 0 })[2]).toBe('~45 min');
  });

  it('cae a un fallback antes que mandar una variable vacia', () => {
    const params = buildDailyGreetingParams({
      name: 'Ana',
      focus: null,
      durationMin: null,
      exerciseCount: 0,
    });

    expect(params).toEqual(['Ana', 'tu rutina del dia', 'a tu ritmo']);
  });

  it('nunca deja una variable vacia, aunque el foco sea espacios', () => {
    const params = buildDailyGreetingParams({ ...base, focus: '   ' });

    for (const p of params) expect(p.trim().length).toBeGreaterThan(0);
  });

  it('colapsa saltos de linea y espacios repetidos que Meta rechaza', () => {
    const params = buildDailyGreetingParams({ ...base, focus: 'Pierna\n  y   core' });

    expect(params[1]).toBe('Pierna y core');
    for (const p of params) expect(p).not.toMatch(/[\n\t]|\s{2}/);
  });
});
