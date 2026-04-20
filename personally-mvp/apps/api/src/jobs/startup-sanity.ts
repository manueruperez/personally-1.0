import { prisma } from '@personally/db';
import { logger } from '../lib/logger.js';

/**
 * Corre una vez al arrancar el API. Dos cosas:
 *
 *  1. **Cleanup de sesiones zombie**: marca como `abandoned` cualquier sesión
 *     en `in_progress` cuya `scheduledDate` ya pasó (p.ej. quedó colgada porque
 *     el API se cayó antes de finalizarla). Así no bloquea creación futura.
 *
 *  2. **Log de diagnóstico**: cuenta sesiones de hoy por status + mensajes
 *     outbound con error en últimas 24h. Útil para detectar drifts silenciosos.
 */
export async function runStartupSanity(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Auto-cerrar in_progress de días anteriores
  const staleResult = await prisma.session.updateMany({
    where: {
      status: 'in_progress',
      scheduledDate: { lt: today },
    },
    data: {
      status: 'abandoned',
      finishedAt: new Date(),
    },
  });
  if (staleResult.count > 0) {
    logger.warn(
      { count: staleResult.count },
      'startup-sanity: cerradas sesiones in_progress zombie de días anteriores',
    );
  }

  // 2. Diagnóstico de hoy
  const todayCounts = await prisma.session.groupBy({
    by: ['status'],
    where: { scheduledDate: today },
    _count: { _all: true },
  });

  const since = new Date(Date.now() - 24 * 3600_000);
  const errorsLast24h = await prisma.message.count({
    where: { direction: 'outbound', error: { not: null }, sentAt: { gte: since } },
  });

  logger.info(
    {
      todaySessions: Object.fromEntries(todayCounts.map((c) => [c.status, c._count._all])),
      outboundErrorsLast24h: errorsLast24h,
    },
    'startup-sanity: snapshot',
  );
}
