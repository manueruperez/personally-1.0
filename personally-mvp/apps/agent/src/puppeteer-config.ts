/**
 * Config de lanzamiento de Puppeteer para whatsapp-web.js.
 *
 * Extraida como funcion pura para poder testearla sin instanciar el Client.
 *
 * En dev (macOS/Linux con Chromium bundled de puppeteer) no hace falta nada.
 * En Docker seteamos PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium para usar
 * el Chromium del sistema (el bundled no trae las libs del contenedor).
 */

export interface PuppeteerLaunchConfig {
  headless: boolean;
  executablePath?: string;
  args: string[];
}

export const DEFAULT_PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
] as const;

export function buildPuppeteerConfig(
  env: NodeJS.ProcessEnv = process.env,
): PuppeteerLaunchConfig {
  const executablePath = env.PUPPETEER_EXECUTABLE_PATH?.trim();
  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [...DEFAULT_PUPPETEER_ARGS],
  };
}
