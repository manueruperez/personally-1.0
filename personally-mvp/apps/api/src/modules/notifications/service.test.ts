import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  notification: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  client: { findUnique: vi.fn() },
};

vi.mock('@personally/db', () => ({ prisma: prismaMock }));

const enqueueMock = vi.fn();
vi.mock('../agent/outbox.js', () => ({ enqueue: enqueueMock }));

const { replyToNotification, markNotificationRead, listNotifications } = await import(
  './service.js'
);

const ctx = {
  trainerId: 'trainer-1',
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'trainer@test.com',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listNotifications', () => {
  it('filtra por trainer y organization', async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    await listNotifications(ctx);
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trainerId: 'trainer-1',
          organizationId: 'org-1',
        }),
      }),
    );
  });

  it('solo unread cuando se pide', async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    await listNotifications(ctx, { unreadOnly: true });
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ readAt: null }),
      }),
    );
  });
});

describe('markNotificationRead', () => {
  it('actualiza readAt con scope del trainer', async () => {
    prismaMock.notification.update.mockResolvedValue({ id: 'n1', readAt: new Date() });
    const res = await markNotificationRead('n1', ctx);
    expect(prismaMock.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1', trainerId: 'trainer-1' },
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
    expect(res).toBeDefined();
  });
});

describe('replyToNotification', () => {
  it('encola mensaje al cliente y marca como leída', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: 'n1',
      trainerId: 'trainer-1',
      organizationId: 'org-1',
      metadata: { clientId: 'c1' },
    });
    prismaMock.client.findUnique.mockResolvedValue({ id: 'c1', phone: '+573001234567' });
    prismaMock.notification.update.mockResolvedValue({ id: 'n1', readAt: new Date() });

    const res = await replyToNotification('n1', 'Hola Juan, proba sentadilla hack', ctx);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: 'trainer-1',
        clientId: 'c1',
        phone: '+573001234567',
        text: 'Hola Juan, proba sentadilla hack',
        templateKey: 'trainer_reply',
      }),
    );
    expect(prismaMock.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
    expect(res.queued).toBe(true);
  });

  it('falla si la notif no existe o no pertenece al trainer', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(replyToNotification('nope', 'hola', ctx)).rejects.toThrow(
      'Notificación no encontrada',
    );
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('falla si metadata no tiene clientId', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: 'n1',
      trainerId: 'trainer-1',
      organizationId: 'org-1',
      metadata: {},
    });
    await expect(replyToNotification('n1', 'hola', ctx)).rejects.toThrow(
      'no tiene cliente asociado',
    );
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('falla si el cliente referenciado ya no existe', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: 'n1',
      trainerId: 'trainer-1',
      organizationId: 'org-1',
      metadata: { clientId: 'gone' },
    });
    prismaMock.client.findUnique.mockResolvedValue(null);
    await expect(replyToNotification('n1', 'hola', ctx)).rejects.toThrow(
      'Cliente asociado no encontrado',
    );
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
