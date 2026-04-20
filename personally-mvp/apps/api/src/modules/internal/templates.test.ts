import { describe, expect, it } from 'vitest';
import {
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

  it('sin focus ni duracion es minimalista', () => {
    const text = renderDailyGreeting({
      name: 'Juan',
      focus: null,
      durationMin: null,
      exerciseCount: 0,
    });
    expect(text).toContain('Juan');
    expect(text).toContain('Responde *iniciar*');
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
