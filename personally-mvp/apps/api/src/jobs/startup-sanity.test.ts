import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  session: { updateMany: vi.fn(), groupBy: vi.fn() },
  message: { count: vi.fn() },
};

vi.mock('@personally/db', () => ({ prisma: prismaMock }));
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { runStartupSanity } = await import('./startup-sanity.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runStartupSanity', () => {
  it('cierra sesiones in_progress de días anteriores como abandoned', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.session.groupBy.mockResolvedValue([]);
    prismaMock.message.count.mockResolvedValue(0);

    await runStartupSanity();

    expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'in_progress',
          scheduledDate: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: expect.objectContaining({
          status: 'abandoned',
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('no revienta si no hay zombies (count=0)', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.session.groupBy.mockResolvedValue([]);
    prismaMock.message.count.mockResolvedValue(0);

    await expect(runStartupSanity()).resolves.not.toThrow();
  });

  it('agrupa sesiones de hoy por status para el snapshot', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.session.groupBy.mockResolvedValue([
      { status: 'greeted', _count: { _all: 3 } },
      { status: 'completed', _count: { _all: 1 } },
    ]);
    prismaMock.message.count.mockResolvedValue(0);

    await runStartupSanity();

    expect(prismaMock.session.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({ scheduledDate: expect.any(Date) }),
      }),
    );
  });

  it('cuenta errores outbound de las últimas 24h', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.session.groupBy.mockResolvedValue([]);
    prismaMock.message.count.mockResolvedValue(5);

    await runStartupSanity();

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
