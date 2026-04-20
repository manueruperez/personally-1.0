import { describe, expect, it } from 'vitest';
import { DomainError, statusForCode } from './errors.js';

describe('DomainError', () => {
  it('preserva code, message y details', () => {
    const err = new DomainError('VALIDATION_ERROR', 'Campo X invalido', { field: 'X' });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Campo X invalido');
    expect(err.details).toEqual({ field: 'X' });
    expect(err).toBeInstanceOf(Error);
  });

  it('details es opcional', () => {
    const err = new DomainError('NOT_FOUND', 'Nada aqui');
    expect(err.details).toBeUndefined();
  });
});

describe('statusForCode', () => {
  it('mapea cada code a un HTTP status coherente', () => {
    expect(statusForCode.AUTH_REQUIRED).toBe(401);
    expect(statusForCode.FORBIDDEN).toBe(403);
    expect(statusForCode.NOT_FOUND).toBe(404);
    expect(statusForCode.CONFLICT).toBe(409);
    expect(statusForCode.PLAN_DAY_PAST).toBe(409);
    expect(statusForCode.VALIDATION_ERROR).toBe(422);
    expect(statusForCode.RATE_LIMITED).toBe(429);
    expect(statusForCode.INTERNAL).toBe(500);
  });
});
