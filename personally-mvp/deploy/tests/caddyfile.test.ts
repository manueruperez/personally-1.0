/**
 * Contract tests del Caddyfile: rutas del edge y su ORDEN.
 * Los bloques `handle` de Caddy se evalúan en orden de aparición — si el
 * bloqueo de /api/v1/internal/* queda después del handle genérico de /api/*,
 * las rutas internas quedan expuestas a internet.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const caddyfile = readFileSync(
  fileURLToPath(new URL('../Caddyfile', import.meta.url)),
  'utf8',
);
const caddyfileLocal = readFileSync(
  fileURLToPath(new URL('../Caddyfile.local', import.meta.url)),
  'utf8',
);

describe('Caddyfile', () => {
  it('sirve el sitio en el dominio de .env (single domain)', () => {
    expect(caddyfile).toMatch(/^\{\$DOMAIN\} \{/m);
  });

  it('proxy /auth/v1/* → gotrue quitando el prefijo (handle_path)', () => {
    const block = caddyfile.match(/handle_path \/auth\/v1\/\* \{[^}]*\}/s)?.[0];
    expect(block).toBeDefined();
    expect(block).toContain('reverse_proxy gotrue:9999');
  });

  it('bloquea /api/v1/internal/* con 403 ANTES del handle genérico de /api/*', () => {
    const internalIdx = caddyfile.indexOf('handle /api/v1/internal/*');
    const genericIdx = caddyfile.indexOf('handle /api/*');
    expect(internalIdx).toBeGreaterThan(-1);
    expect(genericIdx).toBeGreaterThan(-1);
    expect(internalIdx).toBeLessThan(genericIdx);

    const internalBlock = caddyfile.match(/handle \/api\/v1\/internal\/\* \{[^}]*\}/s)?.[0];
    expect(internalBlock).toContain('403');
    expect(internalBlock).not.toContain('reverse_proxy');
  });

  it('proxy /api/* y /health → api:3000', () => {
    expect(caddyfile).toMatch(/handle \/api\/\* \{[^}]*reverse_proxy api:3000[^}]*\}/s);
    expect(caddyfile).toMatch(/handle \/health \{[^}]*reverse_proxy api:3000[^}]*\}/s);
  });

  it('sirve el SPA con fallback a index.html (rutas de react-router)', () => {
    expect(caddyfile).toContain('try_files {path} /index.html');
    expect(caddyfile).toContain('file_server');
  });

  it('Caddyfile.local (validación sin TLS) mantiene las mismas rutas y orden', () => {
    const routes = [
      'handle_path /auth/v1/*',
      'handle /api/v1/internal/*',
      'handle /api/*',
      'handle /health',
    ];
    let prev = -1;
    for (const route of routes) {
      const idx = caddyfileLocal.indexOf(route);
      expect(idx, `Caddyfile.local debe tener "${route}"`).toBeGreaterThan(prev);
      prev = idx;
    }
    expect(caddyfileLocal).toContain('reverse_proxy gotrue:9999');
    expect(caddyfileLocal).toContain('try_files {path} /index.html');
  });
});
