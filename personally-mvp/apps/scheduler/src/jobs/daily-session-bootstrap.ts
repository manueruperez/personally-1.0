import { logger } from '../logger.js';

/**
 * NOOP — la implementación real vive en `apps/api/src/jobs/daily-bootstrap.ts`
 * y corre como `node-cron` dentro del mismo proceso del API (cada 5 min).
 *
 * Este stub se conserva por si en el futuro se decide separar el scheduler
 * en un proceso propio (por ejemplo para desplegarlo en otro VPS o aislar
 * fallos). Mientras tanto, NO se inicia el scheduler — el API se auto-gestiona.
 */
export async function dailySessionBootstrap(): Promise<void> {
  logger.debug('daily-session-bootstrap: noop (real impl lives in apps/api)');
}
