import { describe, expect, it } from 'vitest';
import {
  ACTIVE_HOURS,
  calculateCompletionRate,
  isWithinActiveHours,
  MAX_MESSAGES_PER_DAY_PER_NUMBER,
  MIN_PLAN_DURATION_DAYS,
} from './rules.js';

describe('constants', () => {
  it('plan minimo 90 dias', () => {
    expect(MIN_PLAN_DURATION_DAYS).toBe(90);
  });

  it('active hours 5am-9pm', () => {
    expect(ACTIVE_HOURS.startHour).toBe(5);
    expect(ACTIVE_HOURS.endHour).toBe(21);
  });

  it('limite anti-baneo razonable', () => {
    expect(MAX_MESSAGES_PER_DAY_PER_NUMBER).toBeLessThanOrEqual(500);
  });
});

describe('isWithinActiveHours', () => {
  const tz = 'America/Bogota';
  // Bogota = UTC-5. Hora H en Bogota = UTC (H+5). Si excede 24, rolover de dia.
  const bogotaAt = (hour: number): Date => {
    const utcHour = (hour + 5) % 24;
    const utcDay = 20 + Math.floor((hour + 5) / 24);
    return new Date(
      `2026-04-${String(utcDay).padStart(2, '0')}T${String(utcHour).padStart(2, '0')}:00:00Z`,
    );
  };

  it('7am Bogota → activo', () => {
    expect(isWithinActiveHours(bogotaAt(7), tz)).toBe(true);
  });

  it('5am Bogota (limite inferior) → activo', () => {
    expect(isWithinActiveHours(bogotaAt(5), tz)).toBe(true);
  });

  it('9pm Bogota (limite superior exclusivo) → inactivo', () => {
    expect(isWithinActiveHours(bogotaAt(21), tz)).toBe(false);
  });

  it('4am Bogota → inactivo', () => {
    expect(isWithinActiveHours(bogotaAt(4), tz)).toBe(false);
  });

  it('11pm Bogota → inactivo', () => {
    expect(isWithinActiveHours(bogotaAt(23), tz)).toBe(false);
  });
});

describe('calculateCompletionRate', () => {
  it('done/total', () => {
    expect(calculateCompletionRate(5, 10)).toBe(0.5);
    expect(calculateCompletionRate(10, 10)).toBe(1);
    expect(calculateCompletionRate(0, 10)).toBe(0);
  });

  it('total cero → 0', () => {
    expect(calculateCompletionRate(0, 0)).toBe(0);
    expect(calculateCompletionRate(5, 0)).toBe(0);
  });

  it('redondea a 3 decimales', () => {
    expect(calculateCompletionRate(1, 3)).toBe(0.333);
    expect(calculateCompletionRate(2, 3)).toBe(0.667);
  });
});
