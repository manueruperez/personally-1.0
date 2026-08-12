/**
 * Contract tests del docker-compose de deploy.
 *
 * No levantan Docker: parsean el YAML y verifican los invariantes que, si se
 * rompen, producen un deploy inseguro o un stack que no se habla entre sí.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const composePath = fileURLToPath(new URL('../docker-compose.yml', import.meta.url));

interface ComposeService {
  image?: string;
  build?: { context: string; dockerfile: string; args?: Record<string, string> };
  restart?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: Record<string, { condition: string }> | string[];
  healthcheck?: unknown;
}

interface ComposeFile {
  name: string;
  services: Record<string, ComposeService>;
  volumes: Record<string, unknown>;
}

const compose = parse(readFileSync(composePath, 'utf8')) as ComposeFile;
const services = compose.services;

describe('docker-compose: estructura', () => {
  it('define exactamente los 5 servicios del stack', () => {
    expect(Object.keys(services).sort()).toEqual(['agent', 'api', 'caddy', 'gotrue', 'postgres']);
  });

  it('todos los servicios tienen restart: unless-stopped', () => {
    for (const [name, svc] of Object.entries(services)) {
      expect(svc.restart, `servicio ${name}`).toBe('unless-stopped');
    }
  });

  it('declara exactamente los volúmenes persistentes del stack', () => {
    expect(Object.keys(compose.volumes).sort()).toEqual(['caddy_config', 'caddy_data', 'pgdata']);
  });
});

describe('docker-compose: exposición a internet', () => {
  it('solo caddy publica puertos, y solo 80/443', () => {
    for (const [name, svc] of Object.entries(services)) {
      if (name === 'caddy') {
        expect(svc.ports).toEqual(['80:80', '443:443']);
      } else {
        expect(svc.ports, `servicio ${name} NO debe publicar puertos`).toBeUndefined();
      }
    }
  });
});

describe('docker-compose: postgres', () => {
  const pg = services.postgres;

  it('persiste datos en el volumen pgdata', () => {
    expect(pg.volumes?.some((v) => v.startsWith('pgdata:'))).toBe(true);
  });

  it('monta el init SQL que crea el schema auth para GoTrue', () => {
    expect(pg.volumes?.some((v) => v.includes('postgres/init'))).toBe(true);
  });

  it('tiene healthcheck (api y gotrue dependen de él)', () => {
    expect(pg.healthcheck).toBeDefined();
  });
});

describe('docker-compose: gotrue (Supabase Auth standalone)', () => {
  const env = services.gotrue.environment!;

  it('firma JWT con el MISMO secret que verifica la API', () => {
    expect(env.GOTRUE_JWT_SECRET).toBe('${SUPABASE_JWT_SECRET}');
    expect(services.api.environment!.SUPABASE_JWT_SECRET).toBe('${SUPABASE_JWT_SECRET}');
  });

  it('usa el schema auth del postgres interno (no toca public/Prisma)', () => {
    expect(env.GOTRUE_DB_DATABASE_URL).toContain('@postgres:5432/personally');
    expect(env.GOTRUE_DB_DATABASE_URL).toContain('search_path=auth');
  });

  it('deshabilita signup público — solo el bootstrap admin crea usuarios', () => {
    expect(String(env.GOTRUE_DISABLE_SIGNUP)).toBe('true');
  });

  it('acepta el service role key como admin (rol service_role)', () => {
    expect(env.GOTRUE_JWT_ADMIN_ROLES).toBe('service_role');
  });
});

describe('docker-compose: api', () => {
  const env = services.api.environment!;

  it('conecta al postgres interno SIN params de pgbouncer (single instance)', () => {
    expect(env.DATABASE_URL).toContain('@postgres:5432/personally');
    expect(env.DATABASE_URL).not.toContain('pgbouncer');
    expect(env.DIRECT_URL).toContain('@postgres:5432/personally');
  });

  it('restringe CORS al dominio público', () => {
    expect(env.CORS_ORIGINS).toBe('https://${DOMAIN}');
  });

  it('comparte AGENT_TOKEN con el agente (mismo var de .env)', () => {
    expect(env.AGENT_TOKEN).toBe('${AGENT_TOKEN}');
    expect(services.agent.environment!.AGENT_TOKEN).toBe('${AGENT_TOKEN}');
  });

  it('espera a que postgres esté healthy antes de arrancar', () => {
    const deps = services.api.depends_on as Record<string, { condition: string }>;
    expect(deps.postgres.condition).toBe('service_healthy');
  });

  it('corre en NODE_ENV=production y NUNCA con TESTING_DOW', () => {
    expect(env.NODE_ENV).toBe('production');
    expect(env.TESTING_DOW).toBeUndefined();
  });
});

describe('docker-compose: agent', () => {
  const agent = services.agent;
  const env = agent.environment!;

  it('habla con la API por la red interna del compose, no por el dominio', () => {
    expect(env.API_BASE_URL).toBe('http://api:3000');
  });

  it('no arrastra nada de Puppeteer: el canal viejo ya no existe', () => {
    expect(env.PUPPETEER_EXECUTABLE_PATH).toBeUndefined();
  });

  it('no monta volúmenes: la Cloud API no guarda sesión en disco', () => {
    expect(agent.volumes).toBeUndefined();
  });

  it('espera a que la API esté healthy (evita drenar outbox contra API caída)', () => {
    const deps = agent.depends_on as Record<string, { condition: string }>;
    expect(deps.api.condition).toBe('service_healthy');
  });
});

describe('docker-compose: caddy (frontend + edge)', () => {
  const caddy = services.caddy;

  it('hornea VITE_API_BASE_URL vacío → frontend pega same-origin', () => {
    expect(caddy.build?.args?.VITE_API_BASE_URL).toBe('');
  });

  it('hornea el supabase URL del dominio y el anon key generado', () => {
    expect(caddy.build?.args?.VITE_SUPABASE_URL).toBe('https://${DOMAIN}');
    expect(caddy.build?.args?.VITE_SUPABASE_ANON_KEY).toBe('${SUPABASE_ANON_KEY}');
  });

  it('persiste certificados TLS entre reinicios', () => {
    expect(caddy.volumes).toContain('caddy_data:/data');
  });
});

describe('docker-compose: canal WhatsApp Cloud API', () => {
  it('el API recibe el secreto y el verify token del webhook', () => {
    const env = services.api.environment ?? {};

    expect(env.WHATSAPP_APP_SECRET).toBe('${WHATSAPP_APP_SECRET:-}');
    expect(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN).toBe('${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}');
  });

  it('no queda variable CHANNEL: hay un solo canal y no se elige', () => {
    expect(services.agent.environment?.CHANNEL).toBeUndefined();
  });

  it('el agente recibe las credenciales de la Cloud API', () => {
    const env = services.agent.environment ?? {};

    expect(env.WHATSAPP_PHONE_NUMBER_ID).toBe('${WHATSAPP_PHONE_NUMBER_ID:-}');
    expect(env.WHATSAPP_ACCESS_TOKEN).toBe('${WHATSAPP_ACCESS_TOKEN:-}');
    expect(env.WHATSAPP_TEMPLATE_LANGUAGE).toBe('${WHATSAPP_TEMPLATE_LANGUAGE:-es}');
  });

  it('el token permanente no se filtra al frontend: caddy no lo recibe', () => {
    const buildArgs = services.caddy.build?.args ?? {};
    const env = services.caddy.environment ?? {};

    for (const bag of [buildArgs, env]) {
      expect(Object.keys(bag).join(',')).not.toMatch(/WHATSAPP_ACCESS_TOKEN|APP_SECRET/);
    }
  });
});
