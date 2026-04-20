/**
 * Tests del dispatcher con Prisma + outbox mockeados.
 *
 * Aislamos toda IO. Validamos que dado un intent + contexto:
 *   - se llamen las mutations correctas en Prisma (con los args esperados)
 *   - se encole el mensaje correcto en el outbox (si corresponde)
 *   - se devuelva el triggeredAction correcto
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ANTES de importar el dispatcher (vi.mock se hoistea)
const prismaMock = {
  plan: { findFirst: vi.fn() },
  session: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  exerciseLog: {
    update: vi.fn(),
    findMany: vi.fn(),
  },
  notification: { create: vi.fn() },
  client: { findUniqueOrThrow: vi.fn() },
};

vi.mock('@personally/db', () => ({
  prisma: prismaMock,
  Prisma: {
    Decimal: class MockDecimal {
      value: number | string;
      constructor(n: number | string) {
        this.value = n;
      }
    },
  },
}));

const enqueueMock = vi.fn();
vi.mock('../agent/outbox.js', () => ({
  enqueue: enqueueMock,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Ahora si: importar el dispatcher
const { dispatch } = await import('./dispatcher.js');

// Helpers --------------------------------------------------------------------

function makeParams(overrides: Partial<Parameters<typeof dispatch>[0]> = {}) {
  return {
    clientId: 'client-1',
    trainerId: 'trainer-1',
    organizationId: 'org-1',
    phone: '+573001234567',
    clientName: 'Juan Perez',
    intent: 'START' as const,
    messageText: 'iniciar',
    ...overrides,
  };
}

function makePlan(overrides: Record<string, unknown> = {}) {
  // Plan que arranca hoy, 12 semanas, miercoles (dow=3) con 2 items
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    id: 'plan-1',
    clientId: 'client-1',
    startDate: today.toISOString(),
    endDate: new Date(today.getTime() + 90 * 86400000).toISOString(),
    status: 'active',
    weeks: [
      {
        id: 'week-1',
        weekNumber: 1,
        days: [
          {
            id: 'day-miercoles',
            dayOfWeek: 3,
            focus: 'Pierna',
            estimatedDurationMin: 45,
            isRestDay: false,
            items: [
              {
                id: 'item-warmup-0',
                block: 'warmup' as const,
                orderIndex: 0,
                sets: null,
                reps: '8 min',
                restSeconds: null,
                rpeTarget: 5,
                cues: null,
                exercise: { id: 'ex-1', nameEs: 'Movilidad', imageUrl: null },
              },
              {
                id: 'item-exercise-0',
                block: 'exercise' as const,
                orderIndex: 0,
                sets: 3,
                reps: '10',
                restSeconds: 90,
                rpeTarget: 7,
                cues: null,
                exercise: { id: 'ex-2', nameEs: 'Sentadilla', imageUrl: null },
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    id: 'session-1',
    clientId: 'client-1',
    planDayId: 'day-miercoles',
    scheduledDate: today,
    status: 'greeted',
    itemsTotal: 2,
    itemsDone: 0,
    itemsSkipped: 0,
    itemsPresented: 0,
    logs: [
      {
        id: 'log-0',
        planItemId: 'item-warmup-0',
        exerciseId: 'ex-1',
        orderInSession: 0,
        status: 'pending',
        presentedAt: null,
      },
      {
        id: 'log-1',
        planItemId: 'item-exercise-0',
        exerciseId: 'ex-2',
        orderInSession: 1,
        status: 'pending',
        presentedAt: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Forzar dow=3 (miercoles) para que el plan match sea deterministico
  process.env.TESTING_DOW = '3';
});

afterEach(() => {
  delete process.env.TESTING_DOW;
});

// Tests ----------------------------------------------------------------------

describe('dispatch — edge cases de plan', () => {
  it('sin plan activo → TXT_NO_ACTIVE_PLAN + triggeredAction=no_active_plan', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(null);

    const result = await dispatch(makeParams());

    expect(result.triggeredAction).toBe('no_active_plan');
    expect(result.sessionId).toBeNull();
    expect(enqueueMock).toHaveBeenCalledOnce();
    expect(enqueueMock.mock.calls[0][0].templateKey).toBe('no_active_plan');
  });

  it('plan con fecha futura → plan_future', async () => {
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 10);
    const plan = makePlan({
      startDate: futureStart.toISOString(),
      endDate: new Date(futureStart.getTime() + 90 * 86400000).toISOString(),
    });
    prismaMock.plan.findFirst.mockResolvedValueOnce(plan);

    const result = await dispatch(makeParams());

    expect(result.triggeredAction).toBe('plan_future');
    expect(enqueueMock).toHaveBeenCalledOnce();
  });

  it('plan sin plan_day para el dow actual → rest_day', async () => {
    // Plan solo tiene dow=1 (lunes); TESTING_DOW=3 no matchea
    const plan = makePlan();
    plan.weeks[0].days[0].dayOfWeek = 1;
    prismaMock.plan.findFirst.mockResolvedValueOnce(plan);

    const result = await dispatch(makeParams());

    expect(result.triggeredAction).toBe('rest_day');
  });

  it('plan_day marcado como rest → rest_day', async () => {
    const plan = makePlan();
    plan.weeks[0].days[0].isRestDay = true;
    prismaMock.plan.findFirst.mockResolvedValueOnce(plan);

    const result = await dispatch(makeParams());

    expect(result.triggeredAction).toBe('rest_day');
  });
});

describe('dispatch — START', () => {
  it('crea session si no existe y presenta primer item', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    prismaMock.session.findFirst.mockResolvedValueOnce(null);

    const createdSession = makeSession();
    prismaMock.session.create.mockResolvedValueOnce(createdSession);
    // presentNextOrFinish refetch
    prismaMock.session.findUniqueOrThrow.mockResolvedValueOnce(createdSession);
    // exerciseLog.update para marcar presented
    prismaMock.exerciseLog.update.mockResolvedValue({});
    // recomputeSessionStats: findMany + update session
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'presented', presentedAt: new Date() },
      { status: 'pending', presentedAt: null },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    const result = await dispatch(makeParams({ intent: 'START' }));

    expect(prismaMock.session.create).toHaveBeenCalledOnce();
    expect(result.triggeredAction).toBe('present_item');
    expect(result.exerciseLogId).toBe('log-0');
    expect(enqueueMock).toHaveBeenCalledOnce();
    expect(enqueueMock.mock.calls[0][0].templateKey).toBe('exercise_card');
    expect(enqueueMock.mock.calls[0][0].text).toContain('Movilidad');
  });

  it('si el ejercicio tiene imageUrl, encola como image con caption', async () => {
    const planWithImg = makePlan();
    // Forzar imageUrl en el primer item
    planWithImg.weeks[0].days[0].items[0].exercise.imageUrl =
      'https://cdn.example.com/warmup.png';
    prismaMock.plan.findFirst.mockResolvedValueOnce(planWithImg);
    prismaMock.session.findFirst.mockResolvedValueOnce(null);
    const createdSession = makeSession();
    prismaMock.session.create.mockResolvedValueOnce(createdSession);
    prismaMock.session.findUniqueOrThrow.mockResolvedValueOnce(createdSession);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'presented', presentedAt: new Date() },
      { status: 'pending', presentedAt: null },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    await dispatch(makeParams({ intent: 'START' }));

    const enqueued = enqueueMock.mock.calls[0][0];
    expect(enqueued.contentType).toBe('image');
    expect(enqueued.mediaUrl).toBe('https://cdn.example.com/warmup.png');
    expect(enqueued.caption).toContain('Movilidad');
    expect(enqueued.text).toBeUndefined();
  });

  it('si no hay imageUrl, encola como texto', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    prismaMock.session.findFirst.mockResolvedValueOnce(null);
    const createdSession = makeSession();
    prismaMock.session.create.mockResolvedValueOnce(createdSession);
    prismaMock.session.findUniqueOrThrow.mockResolvedValueOnce(createdSession);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'presented', presentedAt: new Date() },
      { status: 'pending', presentedAt: null },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    await dispatch(makeParams({ intent: 'START' }));

    const enqueued = enqueueMock.mock.calls[0][0];
    expect(enqueued.contentType).toBe('text');
    expect(enqueued.mediaUrl).toBeUndefined();
    expect(enqueued.text).toContain('Movilidad');
  });

  it('si ya hay un item presented, START no re-presenta (idempotencia)', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      status: 'in_progress',
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-warmup-0',
          exerciseId: 'ex-1',
          orderInSession: 0,
          status: 'presented',
          presentedAt: new Date(),
        },
      ],
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);

    const result = await dispatch(makeParams({ intent: 'START' }));

    expect(result.triggeredAction).toBe('already_started');
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe('dispatch — NEXT', () => {
  it('marca el current como done y presenta el siguiente', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      status: 'in_progress',
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-warmup-0',
          exerciseId: 'ex-1',
          orderInSession: 0,
          status: 'presented',
          presentedAt: new Date(),
        },
        {
          id: 'log-1',
          planItemId: 'item-exercise-0',
          exerciseId: 'ex-2',
          orderInSession: 1,
          status: 'pending',
          presentedAt: null,
        },
      ],
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.session.findUniqueOrThrow.mockResolvedValueOnce({
      ...session,
      logs: [
        { ...session.logs[0], status: 'done' },
        session.logs[1],
      ],
    });
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'done', presentedAt: new Date() },
      { status: 'presented', presentedAt: new Date() },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    const result = await dispatch(makeParams({ intent: 'NEXT' }));

    // El update del current a done
    expect(prismaMock.exerciseLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-0' },
        data: expect.objectContaining({ status: 'done' }),
      }),
    );
    expect(result.triggeredAction).toBe('present_item');
    expect(enqueueMock.mock.calls[0][0].text).toContain('Sentadilla');
  });

  it('NEXT al ultimo item → finaliza la sesion', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-warmup-0',
          exerciseId: 'ex-1',
          orderInSession: 0,
          status: 'presented',
          presentedAt: new Date(),
        },
      ],
      itemsTotal: 1,
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.session.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...session,
        logs: [{ ...session.logs[0], status: 'done' }],
      })
      // Segunda llamada: post-finalize para leer stats
      .mockResolvedValueOnce({ ...session, itemsDone: 1, itemsTotal: 1, completionRate: 1 });
    prismaMock.exerciseLog.findMany.mockResolvedValue([
      { status: 'done', presentedAt: new Date() },
    ]);
    prismaMock.session.update.mockResolvedValue({});
    prismaMock.client.findUniqueOrThrow.mockResolvedValueOnce({
      phone: '+573001234567',
      trainerId: 'trainer-1',
    });

    const result = await dispatch(makeParams({ intent: 'NEXT' }));

    expect(result.triggeredAction).toBe('finish');
    // Enqueue del mensaje de cierre
    expect(enqueueMock).toHaveBeenCalled();
    const finishCall = enqueueMock.mock.calls.find((c) => c[0].templateKey === 'finish');
    expect(finishCall).toBeTruthy();
  });
});

describe('dispatch — SKIP (defer)', () => {
  it('primer skip marca deferred + increment deferCount + presenta siguiente', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      status: 'in_progress',
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-warmup-0',
          exerciseId: 'ex-1',
          orderInSession: 0,
          deferCount: 0,
          status: 'presented',
          presentedAt: new Date(),
        },
        {
          id: 'log-1',
          planItemId: 'item-exercise-0',
          exerciseId: 'ex-2',
          orderInSession: 1,
          deferCount: 0,
          status: 'pending',
          presentedAt: null,
        },
      ],
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.session.findUniqueOrThrow.mockResolvedValueOnce({
      ...session,
      logs: [
        { ...session.logs[0], status: 'deferred', deferCount: 1 },
        session.logs[1],
      ],
    });
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'deferred', presentedAt: null },
      { status: 'presented', presentedAt: new Date() },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    const result = await dispatch(makeParams({ intent: 'SKIP' }));

    expect(prismaMock.exerciseLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-0' },
        data: expect.objectContaining({
          status: 'deferred',
          deferCount: { increment: 1 },
        }),
      }),
    );
    expect(result.triggeredAction).toBe('present_item');
  });

  it('cuarto skip al mismo item (deferCount ya en 3) → skipped permanente', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      status: 'in_progress',
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-warmup-0',
          exerciseId: 'ex-1',
          orderInSession: 0,
          deferCount: 3, // ya en el limite
          status: 'presented',
          presentedAt: new Date(),
        },
      ],
      itemsTotal: 1,
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.session.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...session,
        logs: [{ ...session.logs[0], status: 'skipped' }],
      })
      .mockResolvedValueOnce({ ...session, itemsSkipped: 1, completionRate: 0 });
    prismaMock.exerciseLog.findMany.mockResolvedValue([
      { status: 'skipped', presentedAt: new Date() },
    ]);
    prismaMock.session.update.mockResolvedValue({});
    prismaMock.client.findUniqueOrThrow.mockResolvedValueOnce({
      phone: '+573001234567',
      trainerId: 'trainer-1',
    });

    await dispatch(makeParams({ intent: 'SKIP' }));

    expect(prismaMock.exerciseLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-0' },
        data: expect.objectContaining({ status: 'skipped' }),
      }),
    );
  });
});

describe('dispatch — CHANGE', () => {
  it('marca changed + crea notification + sigue avanzando', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      status: 'in_progress',
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-exercise-0',
          exerciseId: 'ex-2',
          orderInSession: 0,
          status: 'presented',
          presentedAt: new Date(),
        },
      ],
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'changed', presentedAt: new Date() },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    const result = await dispatch(makeParams({ intent: 'CHANGE' }));

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'change_request',
          trainerId: 'trainer-1',
        }),
      }),
    );
    expect(result.triggeredAction).toBe('change_request');
    expect(enqueueMock.mock.calls[0][0].templateKey).toBe('change_ack');
  });
});

describe('dispatch — PAIN (linea roja)', () => {
  it('durante ejercicio: notifica + marca skipped con nota + presenta siguiente', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    const session = makeSession({
      status: 'in_progress',
      logs: [
        {
          id: 'log-0',
          planItemId: 'item-warmup-0',
          exerciseId: 'ex-1',
          orderInSession: 0,
          deferCount: 0,
          status: 'presented',
          presentedAt: new Date(),
        },
        {
          id: 'log-1',
          planItemId: 'item-exercise-0',
          exerciseId: 'ex-2',
          orderInSession: 1,
          deferCount: 0,
          status: 'pending',
          presentedAt: null,
        },
      ],
    });
    prismaMock.session.findFirst.mockResolvedValueOnce(session);
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.exerciseLog.update.mockResolvedValue({});
    prismaMock.session.findUniqueOrThrow.mockResolvedValueOnce({
      ...session,
      logs: [
        { ...session.logs[0], status: 'skipped' },
        session.logs[1],
      ],
    });
    prismaMock.exerciseLog.findMany.mockResolvedValueOnce([
      { status: 'skipped', presentedAt: new Date() },
    ]);
    prismaMock.session.update.mockResolvedValue({});

    const result = await dispatch(
      makeParams({ intent: 'PAIN', messageText: 'me duele la rodilla' }),
    );

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'pain_report',
          metadata: expect.objectContaining({ exerciseLogId: 'log-0' }),
        }),
      }),
    );
    expect(prismaMock.exerciseLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-0' },
        data: expect.objectContaining({
          status: 'skipped',
          notes: expect.stringMatching(/^dolor:/),
        }),
      }),
    );
    expect(result.triggeredAction).toBe('pain_report');
    // Envia el ack y el siguiente exercise_card
    const templateKeys = enqueueMock.mock.calls.map((c) => c[0].templateKey);
    expect(templateKeys[0]).toBe('pain_ack');
    expect(templateKeys).toContain('exercise_card');
  });

  it('sin ejercicio presentado (session greeted): solo notifica, no rompe', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    prismaMock.session.findFirst.mockResolvedValueOnce(makeSession());
    prismaMock.notification.create.mockResolvedValue({});

    const result = await dispatch(makeParams({ intent: 'PAIN', messageText: 'me duele' }));

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'pain_report' }),
      }),
    );
    expect(result.triggeredAction).toBe('pain_report');
    expect(prismaMock.exerciseLog.update).not.toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalledOnce();
    expect(enqueueMock.mock.calls[0][0].templateKey).toBe('pain_ack');
  });
});

describe('dispatch — UNKNOWN', () => {
  it('sesion recien creada (greeted) → mensaje pide iniciar', async () => {
    prismaMock.plan.findFirst.mockResolvedValueOnce(makePlan());
    prismaMock.session.findFirst.mockResolvedValueOnce(makeSession({ status: 'greeted' }));
    prismaMock.session.findUnique = vi.fn().mockResolvedValueOnce({ status: 'greeted' });

    const result = await dispatch(
      makeParams({ intent: 'UNKNOWN', messageText: 'hola' }),
    );

    expect(result.triggeredAction).toBe('unknown_reply');
    expect(enqueueMock.mock.calls[0][0].templateKey).toBe('unknown_reply');
    expect(enqueueMock.mock.calls[0][0].text).toMatch(/iniciar/i);
  });
});
