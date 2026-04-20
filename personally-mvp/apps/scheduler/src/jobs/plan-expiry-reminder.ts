import { prisma } from '@personally/db';
import { logger } from '../logger.js';

/**
 * Recuerda al trainer planes por vencer (<=14 dias).
 */
export async function planExpiryReminder(): Promise<void> {
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  const plans = await prisma.plan.findMany({
    where: { status: 'active', endDate: { lte: soon } },
    select: { id: true, trainerId: true, clientId: true, endDate: true, organizationId: true },
  });

  logger.info({ count: plans.length }, 'plan-expiry-reminder');
  // TODO: crear notification 'plan_expiring' por cada uno (dedup)
}
