import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  planItem: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  planDay: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  planWeek: { findFirst: vi.fn() },
  exercise: { findFirst: vi.fn() },
  client: { findFirst: vi.fn() },
  session: { findFirst: vi.fn(), findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
};

vi.mock('@personally/db', () => ({ prisma: prismaMock }));

vi.mock('../../jobs/daily-bootstrap.js', () => ({
  forceDailyGreeting: vi.fn(),
}));

const {
  updatePlanItem,
  addPlanItem,
  deletePlanItem,
  getTodaySession,
  addPlanDay,
  deletePlanDay,
} = await import('./service.js');
const clientsService = await import('../clients/service.js');

const ctx = {
  trainerId: 'trainer-1',
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'trainer@test.com',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updatePlanItem', () => {
  const stubItem = {
    id: 'item-1',
    day: {
      week: {
        plan: {
          id: 'plan-1',
          status: 'draft',
          organizationId: 'org-1',
          trainerId: 'trainer-1',
        },
      },
    },
  };

  it('actualiza solo los campos provistos', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue(stubItem);
    prismaMock.planItem.update.mockResolvedValue({ id: 'item-1', sets: 4, reps: '10' });

    await updatePlanItem('item-1', { sets: 4 }, ctx);

    expect(prismaMock.planItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: { sets: 4 },
      }),
    );
  });

  it('permite setear null para quitar el valor', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue(stubItem);
    prismaMock.planItem.update.mockResolvedValue({});
    await updatePlanItem('item-1', { rpeTarget: null }, ctx);
    expect(prismaMock.planItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { rpeTarget: null } }),
    );
  });

  it('falla si el item no existe (ownership implicito)', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue(null);
    await expect(updatePlanItem('nope', { sets: 4 }, ctx)).rejects.toThrow('no encontrado');
    expect(prismaMock.planItem.update).not.toHaveBeenCalled();
  });

  it('falla si el plan esta archived', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue({
      ...stubItem,
      day: {
        week: {
          plan: { ...stubItem.day.week.plan, status: 'archived' },
        },
      },
    });
    await expect(updatePlanItem('item-1', { sets: 4 }, ctx)).rejects.toThrow('archivado');
    expect(prismaMock.planItem.update).not.toHaveBeenCalled();
  });

  it('plan active es editable (para ajustes durante piloto)', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue({
      ...stubItem,
      day: {
        week: {
          plan: { ...stubItem.day.week.plan, status: 'active' },
        },
      },
    });
    prismaMock.planItem.update.mockResolvedValue({});
    await updatePlanItem('item-1', { reps: '12' }, ctx);
    expect(prismaMock.planItem.update).toHaveBeenCalled();
  });

  it('swap de ejercicio valida que el destino existe y es accesible', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue(stubItem);
    prismaMock.exercise.findFirst.mockResolvedValue({ id: 'ex-new', nameEs: 'Sentadilla' });
    prismaMock.planItem.update.mockResolvedValue({});

    await updatePlanItem('item-1', { exerciseId: 'ex-new' }, ctx);

    expect(prismaMock.exercise.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'ex-new',
          OR: [{ organizationId: null }, { organizationId: 'org-1' }],
        }),
      }),
    );
    expect(prismaMock.planItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exerciseId: 'ex-new' }),
      }),
    );
  });

  it('swap falla si ejercicio destino no existe o no es accesible', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue(stubItem);
    prismaMock.exercise.findFirst.mockResolvedValue(null);

    await expect(updatePlanItem('item-1', { exerciseId: 'nope' }, ctx)).rejects.toThrow(
      'no encontrado',
    );
    expect(prismaMock.planItem.update).not.toHaveBeenCalled();
  });
});

describe('addPlanItem', () => {
  const stubDay = {
    id: 'day-1',
    items: [{ orderIndex: 2 }],
    week: {
      plan: { id: 'plan-1', status: 'draft', organizationId: 'org-1', trainerId: 'trainer-1' },
    },
  };

  it('agrega item al final del bloque (orderIndex max+1)', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue(stubDay);
    prismaMock.exercise.findFirst.mockResolvedValue({ id: 'ex-new' });
    prismaMock.planItem.create.mockResolvedValue({ id: 'new-item' });

    await addPlanItem('day-1', { exerciseId: 'ex-new', block: 'exercise' }, ctx);

    expect(prismaMock.planItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planDayId: 'day-1',
          exerciseId: 'ex-new',
          block: 'exercise',
          orderIndex: 3,
        }),
      }),
    );
  });

  it('falla si el día no pertenece al trainer', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue(null);
    await expect(
      addPlanItem('day-1', { exerciseId: 'ex-new', block: 'exercise' }, ctx),
    ).rejects.toThrow('no encontrado');
  });

  it('falla si plan archivado', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue({
      ...stubDay,
      week: {
        plan: { ...stubDay.week.plan, status: 'archived' },
      },
    });
    await expect(
      addPlanItem('day-1', { exerciseId: 'ex-new', block: 'exercise' }, ctx),
    ).rejects.toThrow('archivado');
  });

  it('falla si ejercicio no existe o no accesible', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue(stubDay);
    prismaMock.exercise.findFirst.mockResolvedValue(null);
    await expect(
      addPlanItem('day-1', { exerciseId: 'nope', block: 'exercise' }, ctx),
    ).rejects.toThrow('no encontrado');
  });
});

describe('deletePlanItem', () => {
  it('borra item si plan no archivado', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue({
      id: 'item-1',
      day: {
        week: {
          plan: { status: 'draft' },
        },
      },
    });
    prismaMock.planItem.delete.mockResolvedValue({});
    const res = await deletePlanItem('item-1', ctx);
    expect(res.deleted).toBe(true);
    expect(prismaMock.planItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
  });

  it('rechaza si plan archivado', async () => {
    prismaMock.planItem.findFirst.mockResolvedValue({
      id: 'item-1',
      day: { week: { plan: { status: 'archived' } } },
    });
    await expect(deletePlanItem('item-1', ctx)).rejects.toThrow('archivado');
    expect(prismaMock.planItem.delete).not.toHaveBeenCalled();
  });
});

describe('addPlanDay', () => {
  const stubWeek = {
    id: 'week-1',
    plan: { id: 'plan-1', status: 'draft', organizationId: 'org-1', trainerId: 'trainer-1' },
  };

  it('crea el dia con defaults (focus null, isRestDay false)', async () => {
    prismaMock.planWeek.findFirst.mockResolvedValue(stubWeek);
    prismaMock.planDay.findFirst.mockResolvedValue(null);
    prismaMock.planDay.create.mockResolvedValue({ id: 'day-new', dayOfWeek: 2 });

    await addPlanDay('week-1', { dayOfWeek: 2 }, ctx);

    expect(prismaMock.planDay.create).toHaveBeenCalledWith({
      data: {
        planWeekId: 'week-1',
        dayOfWeek: 2,
        focus: null,
        isRestDay: false,
      },
    });
  });

  it('respeta focus e isRestDay cuando vienen', async () => {
    prismaMock.planWeek.findFirst.mockResolvedValue(stubWeek);
    prismaMock.planDay.findFirst.mockResolvedValue(null);
    prismaMock.planDay.create.mockResolvedValue({ id: 'day-new' });

    await addPlanDay('week-1', { dayOfWeek: 5, focus: 'Pierna', isRestDay: true }, ctx);

    expect(prismaMock.planDay.create).toHaveBeenCalledWith({
      data: {
        planWeekId: 'week-1',
        dayOfWeek: 5,
        focus: 'Pierna',
        isRestDay: true,
      },
    });
  });

  it('valida ownership: busca la semana por org + trainer', async () => {
    prismaMock.planWeek.findFirst.mockResolvedValue(stubWeek);
    prismaMock.planDay.findFirst.mockResolvedValue(null);
    prismaMock.planDay.create.mockResolvedValue({ id: 'day-new' });

    await addPlanDay('week-1', { dayOfWeek: 1 }, ctx);

    expect(prismaMock.planWeek.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'week-1',
          plan: { organizationId: 'org-1', trainerId: 'trainer-1' },
        }),
      }),
    );
  });

  it('falla si la semana no es del trainer', async () => {
    prismaMock.planWeek.findFirst.mockResolvedValue(null);
    await expect(addPlanDay('week-1', { dayOfWeek: 2 }, ctx)).rejects.toThrow('no encontrada');
    expect(prismaMock.planDay.create).not.toHaveBeenCalled();
  });

  it('falla si el plan no esta en draft', async () => {
    prismaMock.planWeek.findFirst.mockResolvedValue({
      ...stubWeek,
      plan: { ...stubWeek.plan, status: 'active' },
    });
    await expect(addPlanDay('week-1', { dayOfWeek: 2 }, ctx)).rejects.toThrow('draft');
    expect(prismaMock.planDay.create).not.toHaveBeenCalled();
  });

  it('falla si ya existe un dia con ese dayOfWeek', async () => {
    prismaMock.planWeek.findFirst.mockResolvedValue(stubWeek);
    prismaMock.planDay.findFirst.mockResolvedValue({ id: 'day-existente', dayOfWeek: 2 });
    await expect(addPlanDay('week-1', { dayOfWeek: 2 }, ctx)).rejects.toThrow('Ya existe');
    expect(prismaMock.planDay.create).not.toHaveBeenCalled();
  });
});

describe('deletePlanDay', () => {
  const stubDay = {
    id: 'day-1',
    week: {
      plan: { id: 'plan-1', status: 'draft', organizationId: 'org-1', trainerId: 'trainer-1' },
    },
  };

  it('borra el dia y devuelve deleted true', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue(stubDay);
    prismaMock.planDay.delete.mockResolvedValue({});

    const res = await deletePlanDay('day-1', ctx);

    expect(res.deleted).toBe(true);
    expect(prismaMock.planDay.delete).toHaveBeenCalledWith({ where: { id: 'day-1' } });
  });

  it('valida ownership via week.plan (org + trainer)', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue(stubDay);
    prismaMock.planDay.delete.mockResolvedValue({});

    await deletePlanDay('day-1', ctx);

    expect(prismaMock.planDay.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'day-1',
          week: { plan: { organizationId: 'org-1', trainerId: 'trainer-1' } },
        }),
      }),
    );
  });

  it('falla si el dia no existe o no es del trainer', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue(null);
    await expect(deletePlanDay('nope', ctx)).rejects.toThrow('no encontrado');
    expect(prismaMock.planDay.delete).not.toHaveBeenCalled();
  });

  it('falla si el plan no esta en draft', async () => {
    prismaMock.planDay.findFirst.mockResolvedValue({
      ...stubDay,
      week: { plan: { ...stubDay.week.plan, status: 'active' } },
    });
    await expect(deletePlanDay('day-1', ctx)).rejects.toThrow('draft');
    expect(prismaMock.planDay.delete).not.toHaveBeenCalled();
  });
});

describe('getTodaySession', () => {
  it('null cuando no hay sesion de hoy', async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: 'c1' });
    prismaMock.session.findFirst.mockResolvedValue(null);
    const res = await clientsService.getTodaySession('c1', ctx);
    expect(res).toBeNull();
  });

  it('proyecta logs con block, exerciseName, sets y reps', async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: 'c1' });
    prismaMock.session.findFirst.mockResolvedValue({
      id: 's1',
      status: 'greeted',
      scheduledDate: new Date(),
      greetedAt: new Date(),
      startedAt: null,
      finishedAt: null,
      itemsTotal: 2,
      itemsDone: 0,
      itemsSkipped: 0,
      logs: [
        {
          id: 'l1',
          orderInSession: 0,
          status: 'pending',
          deferCount: 0,
          notes: null,
          exercise: { nameEs: 'Calentamiento' },
          planItem: { block: 'warmup', sets: null, reps: '5 min' },
        },
        {
          id: 'l2',
          orderInSession: 1,
          status: 'pending',
          deferCount: 0,
          notes: null,
          exercise: { nameEs: 'Prensa' },
          planItem: { block: 'exercise', sets: 3, reps: '10' },
        },
      ],
    });
    const res = await clientsService.getTodaySession('c1', ctx);
    expect(res).toBeDefined();
    expect(res!.logs).toHaveLength(2);
    expect(res!.logs[0]).toMatchObject({
      block: 'warmup',
      exerciseName: 'Calentamiento',
      reps: '5 min',
    });
    expect(res!.logs[1]).toMatchObject({
      block: 'exercise',
      exerciseName: 'Prensa',
      sets: 3,
      reps: '10',
    });
  });

  it('valida ownership del cliente (trainer + org)', async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);
    await expect(clientsService.getTodaySession('nope', ctx)).rejects.toThrow('no encontrado');
  });
});
