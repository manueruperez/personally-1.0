import { describe, expect, it } from 'vitest';
import { buildPuppeteerConfig, DEFAULT_PUPPETEER_ARGS } from './puppeteer-config.js';

describe('buildPuppeteerConfig', () => {
  it('sin PUPPETEER_EXECUTABLE_PATH no incluye executablePath (usa el Chromium bundled)', () => {
    const config = buildPuppeteerConfig({});
    expect(config.headless).toBe(true);
    expect('executablePath' in config).toBe(false);
  });

  it('con PUPPETEER_EXECUTABLE_PATH usa el Chromium del sistema (Docker)', () => {
    const config = buildPuppeteerConfig({ PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium' });
    expect(config.executablePath).toBe('/usr/bin/chromium');
  });

  it('ignora PUPPETEER_EXECUTABLE_PATH vacío o solo espacios', () => {
    expect('executablePath' in buildPuppeteerConfig({ PUPPETEER_EXECUTABLE_PATH: '' })).toBe(false);
    expect('executablePath' in buildPuppeteerConfig({ PUPPETEER_EXECUTABLE_PATH: '   ' })).toBe(
      false,
    );
  });

  it('siempre incluye los args de sandbox-off requeridos en contenedores', () => {
    const { args } = buildPuppeteerConfig({});
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-dev-shm-usage');
    expect(args).toEqual([...DEFAULT_PUPPETEER_ARGS]);
  });

  it('devuelve un array nuevo en cada llamada (sin estado compartido mutable)', () => {
    const first = buildPuppeteerConfig({});
    first.args.push('--mutado');
    const second = buildPuppeteerConfig({});
    expect(second.args).not.toContain('--mutado');
  });
});
