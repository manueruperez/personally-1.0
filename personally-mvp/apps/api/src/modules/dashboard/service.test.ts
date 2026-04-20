import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  client: { findMany: vi.fn() },
  session: { findMany: vi.fn() },
  notification: { count: vi.fn() },
  message: { count: vi.fn() },
};

vi.mock('@personally/db', () => ({ prisma: prismaMock }));

const { getTodayDashboard } = await import('./service.js');

const ctx = {
  trainerId: 'trainer-1',
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'trainer@test.com',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTodayDashboard', () => {
  it('agrupa sesiones por cliente y cuenta por status', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      { id: 'c1', name: 'Ana', phone: '+1', preferences: { preferredStartTime: '05:00' } },
      { id: 'c2', name: 'Beto', phone: '+2', preferences: { preferredStartTime: '07:00' } },
      { id: 'c3', name: 'Cami', phone: '+3', preferences: null },
    ]);
    prismaMock.session.findMany.mockResolvedValue([
      {
        id: 's1',
        clientId: 'c1',
        status: 'greeted',
        itemsTotal: 8,
        itemsDone: 0,
        itemsSkipped: 0,
        greetedAt: new Date(),
        startedAt: null,
        finishedAt: null,
      },
      {
        id: 's2',
        clientId: 'c2',
        status: 'in_progress',
        itemsTotal: 8,
        itemsDone: 3,
        itemsSkipped: 1,
        greetedAt: new Date(),
        startedAt: new Date(),
        finishedAt: null,
      },
    ]);
    prismaMock.notification.count.mockResolvedValue(2);
    prismaMock.message.count.mockResolvedValue(0);

    const result = await getTodayDashboard(ctx);

    expect(result.summary).toMatchObject({
      totalClients: 3,
      sessionsCreated: 2,
      greeted: 1,
      inProgress: 1,
      completed: 0,
      noSession: 1,
      unreadNotifications: 2,
      failedMessages: 0,
    });
    expect(result.clients).toHaveLength(3);
    expect(result.clients[0]).toMatchObject({
      id: 'c1',
      session: expect.objectContaining({ status: 'greeted' }),
    });
    expect(result.clients[2]).toMatchObject({
      id: 'c3',
      session: null,
      preferredStartTime: null,
    });
  });

  it('cliente sin sesion de hoy queda con session null', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      { id: 'c1', name: 'Solo', phone: '+1', preferences: { preferredStartTime: '06:00' } },
    ]);
    prismaMock.session.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.message.count.mockResolvedValue(0);

    const result = await getTodayDashboard(ctx);

    expect(result.summary.noSession).toBe(1);
    expect(result.summary.sessionsCreated).toBe(0);
    expect(result.clients[0].session).toBeNull();
    expect(result.clients[0].preferredStartTime).toBe('06:00');
  });

  it('filtra por trainerId + organizationId', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.session.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.message.count.mockResolvedValue(0);

    await getTodayDashboard(ctx);

    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trainerId: 'trainer-1',
          organizationId: 'org-1',
          status: 'active',
        }),
      }),
    );
    expect(prismaMock.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trainerId: 'trainer-1',
          organizationId: 'org-1',
          readAt: null,
        }),
      }),
    );
  });

  it('failedMessages cuenta outbound con error en ultimas 24h', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.session.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.message.count.mockResolvedValue(3);

    const result = await getTodayDashboard(ctx);

    expect(result.summary.failedMessages).toBe(3);
    expect(prismaMock.message.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          direction: 'outbound',
          error: { not: null },
          sentAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });
});
