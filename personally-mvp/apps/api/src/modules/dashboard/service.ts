import { prisma } from '@personally/db';
import type { AuthContext } from '../../middleware/auth.js';

export async function getTodayDashboard(ctx: AuthContext) {
  const { trainerId, organizationId } = ctx;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const clients = await prisma.client.findMany({
    where: { trainerId, organizationId, status: 'active' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      preferences: { select: { preferredStartTime: true, timezone: true } },
    },
  });

  const sessions = await prisma.session.findMany({
    where: {
      clientId: { in: clients.map((c) => c.id) },
      scheduledDate: today,
    },
    select: {
      id: true,
      clientId: true,
      status: true,
      itemsTotal: true,
      itemsDone: true,
      itemsSkipped: true,
      greetedAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });
  const byClient = new Map(sessions.map((s) => [s.clientId, s]));

  const unreadNotifications = await prisma.notification.count({
    where: { trainerId, organizationId, readAt: null },
  });

  const since = new Date(Date.now() - 24 * 3600_000);
  const failedMessages = await prisma.message.count({
    where: {
      organizationId,
      direction: 'outbound',
      error: { not: null },
      sentAt: { gte: since },
    },
  });

  const clientsData = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    preferredStartTime: c.preferences?.preferredStartTime ?? null,
    session: byClient.get(c.id) ?? null,
  }));

  const summary = {
    totalClients: clients.length,
    sessionsCreated: sessions.length,
    greeted: sessions.filter((s) => s.status === 'greeted').length,
    inProgress: sessions.filter((s) => s.status === 'in_progress').length,
    completed: sessions.filter((s) => s.status === 'completed').length,
    partial: sessions.filter((s) => s.status === 'partial').length,
    missed: sessions.filter((s) => s.status === 'missed').length,
    noSession: clients.length - sessions.length,
    unreadNotifications,
    failedMessages,
  };

  return { summary, clients: clientsData };
}
