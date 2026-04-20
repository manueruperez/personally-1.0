import 'dotenv/config';
import cron from 'node-cron';
import { logger } from './logger.js';
import { dailySessionBootstrap } from './jobs/daily-session-bootstrap.js';
import { noResponseWatcher } from './jobs/no-response-watcher.js';
import { agentHeartbeatMonitor } from './jobs/agent-heartbeat-monitor.js';
import { metricsRollup } from './jobs/metrics-rollup.js';
import { planExpiryReminder } from './jobs/plan-expiry-reminder.js';

const TZ = process.env.SCHEDULER_TIMEZONE ?? 'America/Bogota';

function register(name: string, schedule: string, handler: () => Promise<void>) {
  cron.schedule(
    schedule,
    async () => {
      const t0 = Date.now();
      logger.info({ job: name }, 'job start');
      try {
        await handler();
        logger.info({ job: name, durationMs: Date.now() - t0 }, 'job done');
      } catch (err) {
        logger.error({ err, job: name }, 'job failed');
      }
    },
    { timezone: TZ },
  );
}

register('daily-session-bootstrap', '0 * * * *', dailySessionBootstrap);
register('no-response-watcher', '0 22 * * *', noResponseWatcher);
register('agent-heartbeat-monitor', '*/2 * * * *', agentHeartbeatMonitor);
register('metrics-rollup', '10 0 * * *', metricsRollup);
register('plan-expiry-reminder', '0 8 * * *', planExpiryReminder);

logger.info({ timezone: TZ }, 'Scheduler started');
