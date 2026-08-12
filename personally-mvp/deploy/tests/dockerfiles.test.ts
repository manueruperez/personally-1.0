/**
 * Contract tests de los Dockerfiles + .dockerignore.
 * Verifican los pasos que, si faltan, el build "pasa" pero el runtime revienta
 * (prisma generate, libs compiladas, artefacto emitido), y que no vuelva a
 * entrar el peso muerto de whatsapp-web.js (Chromium, Puppeteer).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const apiDockerfile = read('../docker/api.Dockerfile');
const agentDockerfile = read('../docker/agent.Dockerfile');
const webDockerfile = read('../docker/web.Dockerfile');
const dockerignore = read('../../.dockerignore');

describe('api.Dockerfile', () => {
  it('genera el Prisma client ANTES de compilar libs — en las 3 imágenes (sin él, libs/db no typechequea)', () => {
    for (const [name, df] of Object.entries({
      api: apiDockerfile,
      agent: agentDockerfile,
      web: webDockerfile,
    })) {
      const generateIdx = df.indexOf('pnpm --filter @personally/db generate');
      const libsIdx = df.indexOf('--filter "./libs/*" build');
      expect(generateIdx, `${name}.Dockerfile debe correr prisma generate`).toBeGreaterThan(-1);
      expect(generateIdx, `${name}.Dockerfile: generate debe ir antes del build de libs`).toBeLessThan(
        libsIdx,
      );
    }
  });

  it('compila libs antes que la app (la API importa dist/ de @personally/*)', () => {
    const libsIdx = apiDockerfile.indexOf('--filter "./libs/*" build');
    const apiIdx = apiDockerfile.indexOf('--filter @personally/api build');
    expect(libsIdx).toBeGreaterThan(-1);
    expect(apiIdx).toBeGreaterThan(libsIdx);
  });

  it('arranca el JS compilado (no tsx) y define healthcheck sobre /health', () => {
    expect(apiDockerfile).toContain('CMD ["node", "apps/api/dist/index.js"]');
    expect(apiDockerfile).toContain('HEALTHCHECK');
    expect(apiDockerfile).toContain('localhost:3000/health');
  });

});

describe('agent.Dockerfile', () => {
  it('arranca el JS compilado desde apps/agent (el CMD usa ruta relativa a dist/)', () => {
    expect(agentDockerfile).toContain('WORKDIR /app/apps/agent');
    expect(agentDockerfile).toContain('CMD ["node", "dist/index.js"]');
  });

  it('usa dumb-init como PID 1 para propagar señales (docker stop limpio)', () => {
    expect(agentDockerfile).toMatch(/ENTRYPOINT \["dumb-init"/);
  });
});

describe('sin rastros de whatsapp-web.js', () => {
  it('ninguna imagen instala Chromium ni configura Puppeteer', () => {
    for (const [name, df] of Object.entries({
      api: apiDockerfile,
      agent: agentDockerfile,
      web: webDockerfile,
    })) {
      expect(df, `${name}.Dockerfile no debe instalar chromium`).not.toMatch(
        /apt-get install[^&]*chromium/s,
      );
      expect(df, `${name}.Dockerfile no debe setear env de Puppeteer`).not.toContain('PUPPETEER_');
    }
  });

  it('el agente no monta ni limpia la sesión LocalAuth (no existe)', () => {
    expect(agentDockerfile).not.toContain('.wwebjs_auth');
    expect(agentDockerfile).not.toContain('agent-entrypoint.sh');
  });
});

describe('web.Dockerfile', () => {
  it('recibe las VITE_* como build args (se hornean al bundle)', () => {
    expect(webDockerfile).toContain('ARG VITE_API_BASE_URL=""');
    expect(webDockerfile).toContain('ARG VITE_SUPABASE_URL');
    expect(webDockerfile).toContain('ARG VITE_SUPABASE_ANON_KEY');
  });

  it('sirve el build con caddy y su Caddyfile', () => {
    expect(webDockerfile).toContain('FROM caddy:2-alpine');
    expect(webDockerfile).toContain('COPY deploy/Caddyfile /etc/caddy/Caddyfile');
    expect(webDockerfile).toContain('COPY --from=build /app/apps/frontend/dist /srv');
  });
});

describe('.dockerignore', () => {
  // .wwebjs_auth ya no lo genera nadie, pero sigue existiendo en las máquinas
  // que corrieron el canal viejo: son cientos de MB de contexto de build.
  it('nunca manda secretos ni sesión vieja de WhatsApp al contexto de build', () => {
    expect(dockerignore).toMatch(/^\.env$/m);
    expect(dockerignore).toMatch(/^\.wwebjs_auth$/m);
    expect(dockerignore).toMatch(/^node_modules$/m);
  });

  it('excluye tsbuildinfo (si entran, el tsc del contenedor no emite dist)', () => {
    expect(dockerignore).toMatch(/^\*\*\/\*\.tsbuildinfo$/m);
  });
});

describe('guards de emisión', () => {
  it('cada imagen verifica que el build realmente emitió su artefacto', () => {
    expect(apiDockerfile).toContain('test -f apps/api/dist/index.js');
    expect(agentDockerfile).toContain('test -f apps/agent/dist/index.js');
    expect(webDockerfile).toContain('test -f apps/frontend/dist/index.html');
  });
});

describe('openssl para Prisma', () => {
  it('los build stages instalan openssl ANTES de pnpm install (engines 3.0.x correctos)', () => {
    for (const [name, df] of Object.entries({
      api: apiDockerfile,
      agent: agentDockerfile,
      web: webDockerfile,
    })) {
      const opensslIdx = df.indexOf('install -y --no-install-recommends openssl');
      const installIdx = df.indexOf('pnpm install --frozen-lockfile');
      expect(opensslIdx, `${name}.Dockerfile: falta openssl en build stage`).toBeGreaterThan(-1);
      expect(opensslIdx, `${name}.Dockerfile: openssl debe ir antes del install`).toBeLessThan(
        installIdx,
      );
    }
  });

  it('el runtime del api también tiene openssl (query/schema engine en runtime)', () => {
    const runtimeStage = apiDockerfile.slice(apiDockerfile.lastIndexOf('FROM node:20'));
    expect(runtimeStage).toContain('openssl');
  });
});
