import { describe, expect, it } from 'vitest';
import { normalize } from './normalize.js';

describe('normalize', () => {
  it('baja a minusculas', () => {
    expect(normalize('HOLA')).toBe('hola');
  });

  it('quita tildes y diacriticos', () => {
    expect(normalize('sábado')).toBe('sabado');
    expect(normalize('Miércoles')).toBe('miercoles');
    expect(normalize('Á É Í Ó Ú Ñ')).toBe('a e i o u n');
  });

  it('colapsa espacios multiples', () => {
    expect(normalize('hola    mundo')).toBe('hola mundo');
  });

  it('trimea', () => {
    expect(normalize('  listo  ')).toBe('listo');
  });

  it('combina todo', () => {
    expect(normalize('  ¡Hoy MARTES  ésto!  ')).toBe('¡hoy martes esto!');
  });

  it('string vacio', () => {
    expect(normalize('')).toBe('');
    expect(normalize('   ')).toBe('');
  });
});
