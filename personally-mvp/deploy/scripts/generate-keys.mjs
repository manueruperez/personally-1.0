/**
 * Genera los secretos del deploy:
 *   - POSTGRES_PASSWORD y AGENT_TOKEN aleatorios
 *   - SUPABASE_JWT_SECRET + SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *     (JWTs HS256 firmados con ese secret, igual que hace Supabase self-hosted:
 *     GoTrue exige que el service role sea un JWT con claim role=service_role)
 *
 * Uso:  node deploy/scripts/generate-keys.mjs >> deploy/.env
 * (o copiar/pegar las líneas al .env del deploy)
 */

import { createHmac, randomBytes } from 'node:crypto';

const b64url = (value) => Buffer.from(value).toString('base64url');

export function signHs256(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function generateDeployKeys(nowSeconds = Math.floor(Date.now() / 1000)) {
  const jwtSecret = randomBytes(32).toString('hex');
  const tenYears = 10 * 365 * 24 * 60 * 60;
  const claims = (role) => ({
    role,
    iss: 'supabase',
    iat: nowSeconds,
    exp: nowSeconds + tenYears,
  });

  return {
    POSTGRES_PASSWORD: randomBytes(16).toString('hex'),
    SUPABASE_JWT_SECRET: jwtSecret,
    SUPABASE_ANON_KEY: signHs256(claims('anon'), jwtSecret),
    SUPABASE_SERVICE_ROLE_KEY: signHs256(claims('service_role'), jwtSecret),
    AGENT_TOKEN: randomBytes(24).toString('hex'),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = generateDeployKeys();
  for (const [name, value] of Object.entries(keys)) {
    console.log(`${name}=${value}`);
  }
}
