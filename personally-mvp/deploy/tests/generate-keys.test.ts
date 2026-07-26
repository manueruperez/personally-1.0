/**
 * Tests del generador de secretos del deploy.
 * Crítico: GoTrue solo acepta el service role si es un JWT HS256 firmado con
 * el MISMO secret y con claim role=service_role (GOTRUE_JWT_ADMIN_ROLES).
 */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — módulo .mjs sin tipos (script de deploy)
import { generateDeployKeys, signHs256 } from '../scripts/generate-keys.mjs';

function decodeJwt(token: string): { header: unknown; payload: Record<string, unknown> } {
  const [h, p] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(p, 'base64url').toString()),
  };
}

function verifyHs256(token: string, secret: string): boolean {
  const [h, p, s] = token.split('.');
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return s === expected;
}

describe('generateDeployKeys', () => {
  const keys = generateDeployKeys(1_700_000_000);

  it('genera todos los secretos que pide deploy/.env.example', () => {
    expect(Object.keys(keys).sort()).toEqual([
      'AGENT_TOKEN',
      'POSTGRES_PASSWORD',
      'SUPABASE_ANON_KEY',
      'SUPABASE_JWT_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });

  it('anon y service role son JWT HS256 firmados con SUPABASE_JWT_SECRET', () => {
    expect(verifyHs256(keys.SUPABASE_ANON_KEY, keys.SUPABASE_JWT_SECRET)).toBe(true);
    expect(verifyHs256(keys.SUPABASE_SERVICE_ROLE_KEY, keys.SUPABASE_JWT_SECRET)).toBe(true);
    expect(decodeJwt(keys.SUPABASE_ANON_KEY).header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('los claims de rol son los que GoTrue espera', () => {
    expect(decodeJwt(keys.SUPABASE_ANON_KEY).payload.role).toBe('anon');
    expect(decodeJwt(keys.SUPABASE_SERVICE_ROLE_KEY).payload.role).toBe('service_role');
  });

  it('los JWT duran ~10 años (no expiran a mitad de piloto)', () => {
    const { payload } = decodeJwt(keys.SUPABASE_SERVICE_ROLE_KEY);
    expect(Number(payload.exp) - Number(payload.iat)).toBe(10 * 365 * 24 * 60 * 60);
  });

  it('secretos con entropía razonable y distintos entre sí', () => {
    expect(keys.SUPABASE_JWT_SECRET.length).toBeGreaterThanOrEqual(64);
    expect(keys.POSTGRES_PASSWORD.length).toBeGreaterThanOrEqual(32);
    expect(keys.AGENT_TOKEN.length).toBeGreaterThanOrEqual(32);
    expect(new Set([keys.POSTGRES_PASSWORD, keys.AGENT_TOKEN, keys.SUPABASE_JWT_SECRET]).size).toBe(
      3,
    );
    // Dos corridas no repiten secretos
    expect(generateDeployKeys(1_700_000_000).SUPABASE_JWT_SECRET).not.toBe(
      keys.SUPABASE_JWT_SECRET,
    );
  });
});

describe('signHs256', () => {
  it('produce firmas verificables y deterministas para el mismo input', () => {
    const token = signHs256({ role: 'anon', iat: 1 }, 'secret');
    expect(verifyHs256(token, 'secret')).toBe(true);
    expect(verifyHs256(token, 'otro-secret')).toBe(false);
    expect(signHs256({ role: 'anon', iat: 1 }, 'secret')).toBe(token);
  });
});
