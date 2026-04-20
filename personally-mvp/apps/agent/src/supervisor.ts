/**
 * Supervisor del agente WhatsApp.
 *
 * Problema: si el proceso del agente muere (crash de Chromium, OOM, uncaught exception),
 * el boton "Reconectar" del frontend no puede hacer nada porque no hay proceso vivo
 * que reciba el SSE command. Este supervisor:
 *
 *  1. Lanza el agente como child process
 *  2. Si exitea con codigo != 0 (o muere por signal), espera 3s, limpia Chromium/locks
 *     residuales y lo relanza.
 *  3. Reintenta hasta MAX_RESTARTS seguidas; luego se queda quieto (evita loop infinito).
 *  4. Exitea limpio ante SIGINT/SIGTERM propagando la senal al hijo.
 *
 * Uso: `pnpm agent:supervised` (o en prod con systemd/PM2 invocando este archivo).
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { existsSync, rmSync } from 'node:fs';

const MAX_RESTARTS_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
const RESTART_DELAY_MS = 3_000;

const AGENT_DIR = path.resolve(import.meta.dirname, '..');
const LOCALAUTH_LOCKS = [
  path.join(AGENT_DIR, '.wwebjs_auth/session/SingletonLock'),
  path.join(AGENT_DIR, '.wwebjs_auth/session/SingletonSocket'),
  path.join(AGENT_DIR, '.wwebjs_auth/session/SingletonCookie'),
];

const log = (...args: unknown[]) =>
  console.log(`[supervisor ${new Date().toISOString()}]`, ...args);

let restartTimestamps: number[] = [];
let child: ChildProcess | null = null;
let shuttingDown = false;

function killStaleChromium(): void {
  try {
    // Busca procesos Chromium/Chrome for Testing que quedaron huerfanos.
    // Uses pkill con patron del path de puppeteer.
    execSync('pkill -f "Chrome for Testing" 2>/dev/null || true', {
      stdio: 'ignore',
    });
    execSync('pkill -f "puppeteer/chrome" 2>/dev/null || true', { stdio: 'ignore' });
  } catch {
    // pkill returns 1 si no mata nada; ignorar
  }
  for (const lock of LOCALAUTH_LOCKS) {
    if (existsSync(lock)) {
      try {
        rmSync(lock, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

function shouldAbortBackoff(): boolean {
  const now = Date.now();
  restartTimestamps = restartTimestamps.filter((t) => now - t < WINDOW_MS);
  restartTimestamps.push(now);
  return restartTimestamps.length > MAX_RESTARTS_PER_WINDOW;
}

function spawnAgent(): void {
  log('spawning agent (tsx src/index.ts)');
  child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: AGENT_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) {
      log(`agent exited (code=${code} signal=${signal}), shutdown en curso`);
      process.exit(code ?? 0);
      return;
    }
    log(`agent exited (code=${code} signal=${signal})`);

    if (shouldAbortBackoff()) {
      log(
        `stop: ${MAX_RESTARTS_PER_WINDOW}+ reinicios en ${WINDOW_MS / 1000}s, el supervisor se detiene`,
      );
      process.exit(1);
    }

    log('limpiando zombies + locks');
    killStaleChromium();
    setTimeout(spawnAgent, RESTART_DELAY_MS);
  });

  child.on('error', (err) => {
    log('spawn error:', err);
  });
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`recibi ${signal}, propagando al agente`);
  if (child && !child.killed) {
    child.kill(signal);
    setTimeout(() => {
      if (child && !child.killed) child.kill('SIGKILL');
      process.exit(0);
    }, 5_000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Al arrancar: limpiar locks huerfanos por si quedo algo de un run anterior.
killStaleChromium();
spawnAgent();
