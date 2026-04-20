import 'dotenv/config';
import cron from 'node-cron';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { runDailyBootstrap } from './jobs/daily-bootstrap.js';
import { runStartupSanity } from './jobs/startup-sanity.js';

const PORT = Number(process.env.API_PORT ?? 3000);

const app = createApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API listening');
  // Non-blocking; errores no tumban el API
  runStartupSanity().catch((err) =>
    logger.error({ err }, 'startup-sanity failed (no bloquea el arranque)'),
  );
});

// Cron: cada 5 minutos evaluar que clientes tienen su hora preferida ahora
cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const result = await runDailyBootstrap({ windowMinutes: 6 });
      if (result.greeted > 0) {
        logger.info(result, 'daily-bootstrap tick');
      } else {
        logger.debug(result, 'daily-bootstrap tick');
      }
    } catch (err) {
      logger.error({ err }, 'daily-bootstrap failed');
    }
  },
  { timezone: process.env.SCHEDULER_TIMEZONE ?? 'America/Bogota' },
);
logger.info('cron daily-bootstrap scheduled (*/5 * * * *)');
