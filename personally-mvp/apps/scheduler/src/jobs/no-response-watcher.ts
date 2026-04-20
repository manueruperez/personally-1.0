import { prisma } from '@personally/db';
import { DEFAULT_NO_RESPONSE_DAYS_THRESHOLD } from '@personally/core';
import { logger } from '../logger.js';

/**
 * Al final del dia: marca como `missed` las sesiones que no iniciaron.
 * Si un cliente acumula N dias consecutivos missed -> notificacion al trainer.
 *
 * TODO: iterar por timezone del cliente, no por hora del servidor.
 */
export async function noResponseWatcher(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const missed = await prisma.session.updateMany({
    where: {
      scheduledDate: today,
      status: { in: ['scheduled', 'greeted'] },
      startedAt: null,
    },
    data: { status: 'missed' },
  });

  logger.info(
    { missedCount: missed.count, threshold: DEFAULT_NO_RESPONSE_DAYS_THRESHOLD },
    'no-response-watcher',
  );

  // TODO: agregar por cliente -> crear notification 'no_response_n_days' si supera umbral
}
