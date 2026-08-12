import 'dotenv/config';
import { createChannel } from './channels/create-channel.js';
import { ApiClient } from './api-client.js';
import { createIncomingHandler } from './handlers/incoming.js';
import { startHeartbeat } from './heartbeat.js';
import { startOutboxWorker } from './outbox-worker.js';
import { logger } from './logger.js';

const AGENT_VERSION = '0.1.0';

async function main() {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
  const agentToken = process.env.AGENT_TOKEN;
  if (!agentToken || agentToken.length < 16) {
    throw new Error('AGENT_TOKEN no seteado o muy corto (>=16 chars)');
  }

  const api = new ApiClient(apiBaseUrl, agentToken, AGENT_VERSION);
  const channel = createChannel();

  channel.onIncoming(createIncomingHandler({ channel, api }));

  channel.onSessionStateChange((state, meta) => {
    logger.info({ state, meta }, 'channel state change');
  });

  await channel.start();
  logger.info('Agent started');

  startHeartbeat({ channel, api });
  startOutboxWorker({ channel, api });

  process.on('SIGINT', async () => {
    logger.info('SIGINT recibido, cerrando...');
    await channel.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Agent failed to start');
  process.exit(1);
});
