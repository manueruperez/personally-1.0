import { prisma, Prisma } from '@personally/db';
import type { Intent } from '@personally/types';
import { enqueue } from '../agent/outbox.js';
import { logger } from '../../lib/logger.js';
import {
  renderDailyGreeting,
  renderExerciseCard,
  renderFinishMessage,
  TXT_CHANGE_ACK,
  TXT_NO_ACTIVE_PLAN,
  TXT_PAIN_ACK,
  TXT_PLAN_ENDED,
  TXT_PLAN_FUTURE,
  TXT_REST_DAY,
  TXT_UNKNOWN_GREETED,
  TXT_UNKNOWN_IN_SESSION,
} from './templates.js';

interface DispatchParams {
  clientId: string;
  trainerId: string;
  organizationId: string;
  phone: string;
  clientName: string;
  intent: Intent;
  messageText: string;
}

interface DispatchResult {
  triggeredAction: string;
  sessionId: string | null;
  exerciseLogId: string | null;
}

function startOfLocalDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayOfWeekMonBased(d: Date): number {
  // JS: Sun=0..Sat=6 → Queremos Mon=1..Sun=7
  return ((d.getDay() + 6) % 7) + 1;
}

export async function dispatch(params: DispatchParams): Promise<DispatchResult> {
  const today = startOfLocalDay();

  const plan = await prisma.plan.findFirst({
    where: { clientId: params.clientId, status: 'active' },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' },
        include: {
          days: {
            orderBy: { dayOfWeek: 'asc' },
            include: {
              items: {
                orderBy: [{ block: 'asc' }, { orderIndex: 'asc' }],
                include: { exercise: { select: { id: true, nameEs: true, imageUrl: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    await sendText(params, TXT_NO_ACTIVE_PLAN, 'no_active_plan');
    return { triggeredAction: 'no_active_plan', sessionId: null, exerciseLogId: null };
  }

  const planStart = startOfLocalDay(new Date(plan.startDate));
  const daysSinceStart = Math.floor((today.getTime() - planStart.getTime()) / 86400000);
  if (daysSinceStart < 0) {
    await sendText(
      params,
      TXT_PLAN_FUTURE(planStart.toISOString().slice(0, 10)),
      'plan_future',
    );
    return { triggeredAction: 'plan_future', sessionId: null, exerciseLogId: null };
  }

  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  // Override opcional para testing: TESTING_DOW=1..7 fuerza el dia-de-semana
  const testingDow = Number(process.env.TESTING_DOW);
  const dow =
    Number.isInteger(testingDow) && testingDow >= 1 && testingDow <= 7
      ? testingDow
      : dayOfWeekMonBased(today);
  if (testingDow) logger.warn({ dow, testingDow }, 'TESTING_DOW override activo');
  const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    await sendText(params, TXT_PLAN_ENDED, 'plan_ended');
    return { triggeredAction: 'plan_ended', sessionId: null, exerciseLogId: null };
  }
  const planDay = week.days.find((d) => d.dayOfWeek === dow);
  if (!planDay || planDay.isRestDay || planDay.items.length === 0) {
    await sendText(params, TXT_REST_DAY, 'rest_day');
    return { triggeredAction: 'rest_day', sessionId: null, exerciseLogId: null };
  }

  // Find or create today's session
  let session = await prisma.session.findFirst({
    where: { clientId: params.clientId, scheduledDate: today },
    include: { logs: { orderBy: { orderInSession: 'asc' } } },
  });

  if (!session) {
    const ordered = [...planDay.items].sort(sortItems);
    const created = await prisma.session.create({
      data: {
        organizationId: params.organizationId,
        clientId: params.clientId,
        planDayId: planDay.id,
        scheduledDate: today,
        channel: 'whatsapp',
        status: 'greeted',
        greetedAt: new Date(),
        itemsTotal: ordered.length,
        logs: {
          create: ordered.map((item, idx) => ({
            planItemId: item.id,
            exerciseId: item.exerciseId,
            orderInSession: idx,
            status: 'pending',
          })),
        },
      },
      include: { logs: { orderBy: { orderInSession: 'asc' } } },
    });
    session = created;

    // No mandamos el saludo automaticamente aqui: asumimos que el agente ya
    // saludo (scheduler o click de trainer) o que el mensaje del cliente es el
    // propio "iniciar". Seguimos procesando el intent abajo.
  }

  const { intent } = params;

  // PAIN: notifica al trainer, marca el ejercicio actual como skipped por dolor,
  // y presenta el siguiente. El ejercicio no vuelve en esta sesion.
  if (intent === 'PAIN') {
    const current = session.logs.find((l) => l.status === 'presented');
    const currentItemName = current
      ? planDay.items.find((i) => i.id === current.planItemId)?.exercise.nameEs
      : undefined;

    await prisma.notification.create({
      data: {
        organizationId: params.organizationId,
        trainerId: params.trainerId,
        type: 'pain_report',
        title: `${params.clientName} reporta dolor`,
        body: params.messageText.slice(0, 500),
        metadata: {
          clientId: params.clientId,
          sessionId: session.id,
          exerciseLogId: current?.id ?? null,
          exerciseName: currentItemName ?? null,
        },
      },
    });

    await sendText(params, TXT_PAIN_ACK, 'pain_ack', session.id);

    // Si no hay ejercicio actual (p.ej. mensaje durante greeted), solo notifica.
    if (!current) {
      return { triggeredAction: 'pain_report', sessionId: session.id, exerciseLogId: null };
    }

    // Marca el ejercicio actual como skipped con nota de dolor.
    await prisma.exerciseLog.update({
      where: { id: current.id },
      data: {
        status: 'skipped',
        finishedAt: new Date(),
        notes: `dolor: ${params.messageText.slice(0, 200)}`,
      },
    });

    // Presenta el siguiente (o finaliza). El PAIN_ACK ya salio; el siguiente ejercicio
    // se envia a continuacion por el outbox.
    const nextResult = await presentNextOrFinish({ params, sessionId: session.id, planDay });
    return {
      triggeredAction: 'pain_report',
      sessionId: session.id,
      exerciseLogId: nextResult.exerciseLogId,
    };
  }

  // CHANGE: marca el item actual como changed + notifica + sigue
  if (intent === 'CHANGE') {
    const current = session.logs.find((l) => l.status === 'presented');
    if (current) {
      await prisma.exerciseLog.update({
        where: { id: current.id },
        data: { status: 'changed', finishedAt: new Date() },
      });
      const itemName = planDay.items.find((i) => i.id === current.planItemId)?.exercise.nameEs;
      await prisma.notification.create({
        data: {
          organizationId: params.organizationId,
          trainerId: params.trainerId,
          type: 'change_request',
          title: `${params.clientName} pide cambio`,
          body: `Ejercicio: ${itemName ?? 'desconocido'}`,
          metadata: {
            clientId: params.clientId,
            sessionId: session.id,
            exerciseLogId: current.id,
          },
        },
      });
    }
    await sendText(params, TXT_CHANGE_ACK, 'change_ack', session.id);
    await recomputeSessionStats(session.id);
    return { triggeredAction: 'change_request', sessionId: session.id, exerciseLogId: current?.id ?? null };
  }

  // FINISH: cierra la sesion
  if (intent === 'FINISH') {
    await finalizeSession(session.id, params.clientName);
    return { triggeredAction: 'finish', sessionId: session.id, exerciseLogId: null };
  }

  // SKIP: difiere el item 1 slot mas adelante (max 3 veces). 4ta vez = skipped permanente.
  if (intent === 'SKIP') {
    const current = session.logs.find((l) => l.status === 'presented');
    if (current) {
      const MAX_DEFERS = 3;
      if (current.deferCount >= MAX_DEFERS) {
        await prisma.exerciseLog.update({
          where: { id: current.id },
          data: { status: 'skipped', finishedAt: new Date() },
        });
      } else {
        // Diferido: se presenta despues del siguiente item. El deferCount
        // incrementa el `effectiveOrder` (orderInSession + deferCount) para
        // que caiga exactamente 1 slot mas adelante que antes.
        await prisma.exerciseLog.update({
          where: { id: current.id },
          data: {
            status: 'deferred',
            deferCount: { increment: 1 },
            presentedAt: null,
            startedAt: null,
          },
        });
      }
    }
    return await presentNextOrFinish({
      params,
      sessionId: session.id,
      planDay,
    });
  }

  // START: si hay pending presenta primero. Si el current ya esta presented, no hace nada.
  if (intent === 'START') {
    const current = session.logs.find((l) => l.status === 'presented');
    if (current) {
      // Ya hay uno presentado, no reenvio
      return {
        triggeredAction: 'already_started',
        sessionId: session.id,
        exerciseLogId: current.id,
      };
    }
    return await presentNextOrFinish({ params, sessionId: session.id, planDay });
  }

  // NEXT: marca el actual como done + presenta siguiente
  if (intent === 'NEXT') {
    const current = session.logs.find((l) => l.status === 'presented');
    if (current) {
      await prisma.exerciseLog.update({
        where: { id: current.id },
        data: { status: 'done', finishedAt: new Date() },
      });
    }
    return await presentNextOrFinish({ params, sessionId: session.id, planDay });
  }

  // UNKNOWN: respuesta suave segun estado
  if (intent === 'UNKNOWN') {
    const fresh = await prisma.session.findUnique({ where: { id: session.id } });
    const text = fresh?.status === 'in_progress' ? TXT_UNKNOWN_IN_SESSION : TXT_UNKNOWN_GREETED;
    await sendText(params, text, 'unknown_reply', session.id);
    return { triggeredAction: 'unknown_reply', sessionId: session.id, exerciseLogId: null };
  }

  return { triggeredAction: 'none', sessionId: session.id, exerciseLogId: null };
}

interface PlanItemWithExercise {
  id: string;
  block: 'warmup' | 'exercise' | 'cooldown';
  orderIndex: number;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  rpeTarget: number | null;
  cues: string | null;
  exercise: { id: string; nameEs: string; imageUrl: string | null };
}

type PlanDayWithItems = {
  id: string;
  focus: string | null;
  estimatedDurationMin: number | null;
  items: PlanItemWithExercise[];
};

async function presentNextOrFinish(input: {
  params: DispatchParams;
  sessionId: string;
  planDay: PlanDayWithItems;
}): Promise<DispatchResult> {
  const { params, sessionId, planDay } = input;
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { logs: { orderBy: { orderInSession: 'asc' } } },
  });

  // Candidatos: pending + deferred. effectiveOrder = orderInSession + deferCount.
  // Empate → pending antes que deferred (para que el diferido caiga despues del siguiente).
  const candidates = session.logs
    .filter((l) => l.status === 'pending' || l.status === 'deferred')
    .map((l) => ({
      log: l,
      effectiveOrder: l.orderInSession + l.deferCount,
      isDeferred: l.status === 'deferred',
    }))
    .sort((a, b) => {
      if (a.effectiveOrder !== b.effectiveOrder) return a.effectiveOrder - b.effectiveOrder;
      // Empate: pending antes que deferred
      if (a.isDeferred !== b.isDeferred) return a.isDeferred ? 1 : -1;
      return a.log.orderInSession - b.log.orderInSession;
    });

  const nextLog = candidates[0]?.log;
  if (!nextLog) {
    await finalizeSession(sessionId, params.clientName);
    return { triggeredAction: 'finish', sessionId, exerciseLogId: null };
  }

  // Pasar el item a presented
  await prisma.exerciseLog.update({
    where: { id: nextLog.id },
    data: {
      status: 'presented',
      presentedAt: new Date(),
      startedAt: new Date(),
    },
  });

  const planItem = planDay.items.find((i) => i.id === nextLog.planItemId);
  if (!planItem) {
    logger.error({ planItemId: nextLog.planItemId }, 'Plan item no encontrado al presentar');
    return { triggeredAction: 'error', sessionId, exerciseLogId: nextLog.id };
  }

  const text = renderExerciseCard({
    order: nextLog.orderInSession + 1,
    total: session.itemsTotal,
    block: planItem.block,
    name: planItem.exercise.nameEs,
    sets: planItem.sets,
    reps: planItem.reps,
    restSeconds: planItem.restSeconds,
    rpeTarget: planItem.rpeTarget,
    cues: planItem.cues,
  });

  // Si el ejercicio tiene imagen, la mandamos como contentType=image con el
  // texto como caption. El canal (whatsapp-web.js) hace MessageMedia.fromUrl.
  // Si la imagen falla de red, el agente tiene fallback a texto-solo via el
  // try/catch de processOne.
  const imageUrl = planItem.exercise.imageUrl ?? undefined;
  enqueue({
    trainerId: params.trainerId,
    clientId: params.clientId,
    phone: params.phone,
    sessionId,
    exerciseLogId: nextLog.id,
    contentType: imageUrl ? 'image' : 'text',
    text: imageUrl ? undefined : text,
    mediaUrl: imageUrl,
    caption: imageUrl ? text : undefined,
    templateKey: 'exercise_card',
    isTemplateBased: true,
  });

  // Transicionar session a in_progress si corresponde
  if (session.status === 'greeted' || session.status === 'scheduled') {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'in_progress', startedAt: new Date() },
    });
  }

  await recomputeSessionStats(sessionId);

  return { triggeredAction: 'present_item', sessionId, exerciseLogId: nextLog.id };
}

async function finalizeSession(sessionId: string, clientName: string) {
  await recomputeSessionStats(sessionId);
  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });

  const allDone = session.itemsDone === session.itemsTotal;
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: allDone ? 'completed' : 'partial',
      finishedAt: new Date(),
    },
  });

  const completionRate = Number(session.completionRate);
  const text = renderFinishMessage({ name: clientName, completionRate });

  // Encolamos directamente con el trainerId recuperado via cliente
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: session.clientId },
    select: { phone: true, trainerId: true },
  });

  enqueue({
    trainerId: client.trainerId,
    clientId: session.clientId,
    phone: client.phone,
    sessionId,
    contentType: 'text',
    text,
    templateKey: 'finish',
    isTemplateBased: true,
  });
}

async function recomputeSessionStats(sessionId: string) {
  const logs = await prisma.exerciseLog.findMany({
    where: { sessionId },
    select: { status: true, presentedAt: true },
  });
  const total = logs.length;
  const presented = logs.filter((l) => l.presentedAt).length;
  const done = logs.filter((l) => l.status === 'done').length;
  const skipped = logs.filter((l) => l.status === 'skipped').length;
  const completionRate = total > 0 ? Math.round((done / total) * 1000) / 1000 : 0;

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      itemsTotal: total,
      itemsPresented: presented,
      itemsDone: done,
      itemsSkipped: skipped,
      completionRate: new Prisma.Decimal(completionRate),
    },
  });
}

async function sendText(
  params: DispatchParams,
  text: string,
  templateKey: string,
  sessionId?: string,
): Promise<void> {
  enqueue({
    trainerId: params.trainerId,
    clientId: params.clientId,
    phone: params.phone,
    sessionId,
    contentType: 'text',
    text,
    templateKey,
    isTemplateBased: true,
  });
}

function sortItems(a: PlanItemWithExercise, b: PlanItemWithExercise): number {
  const blockOrder = { warmup: 0, exercise: 1, cooldown: 2 };
  const ba = blockOrder[a.block];
  const bb = blockOrder[b.block];
  if (ba !== bb) return ba - bb;
  return a.orderIndex - b.orderIndex;
}

// Greeting helper expuesto para scheduler u otros (no usado todavia aqui)
export async function sendDailyGreeting(params: {
  trainerId: string;
  clientId: string;
}): Promise<void> {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: params.clientId },
    select: { name: true, phone: true, organizationId: true },
  });

  const today = startOfLocalDay();
  const plan = await prisma.plan.findFirst({
    where: { clientId: params.clientId, status: 'active' },
    include: {
      weeks: {
        include: {
          days: {
            include: {
              items: {
                include: { exercise: { select: { id: true, nameEs: true, imageUrl: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!plan) return;
  const daysSinceStart = Math.floor(
    (today.getTime() - startOfLocalDay(new Date(plan.startDate)).getTime()) / 86400000,
  );
  if (daysSinceStart < 0) return; // plan a futuro
  const week = plan.weeks.find((w) => w.weekNumber === Math.floor(daysSinceStart / 7) + 1);
  const testingDow = Number(process.env.TESTING_DOW);
  const dow =
    Number.isInteger(testingDow) && testingDow >= 1 && testingDow <= 7
      ? testingDow
      : dayOfWeekMonBased(today);
  if (testingDow) logger.warn({ dow, testingDow }, 'sendDailyGreeting: TESTING_DOW activo');
  const planDay = week?.days.find((d) => d.dayOfWeek === dow);
  if (!planDay || planDay.isRestDay || planDay.items.length === 0) return;

  // Crea la Session eager si no existe. El dispatcher luego la encuentra cuando
  // el cliente responde "iniciar".
  let session = await prisma.session.findFirst({
    where: { clientId: params.clientId, scheduledDate: today },
  });
  if (!session) {
    const ordered = [...planDay.items].sort(sortItems);
    session = await prisma.session.create({
      data: {
        organizationId: client.organizationId,
        clientId: params.clientId,
        planDayId: planDay.id,
        scheduledDate: today,
        channel: 'whatsapp',
        status: 'greeted',
        greetedAt: new Date(),
        itemsTotal: ordered.length,
        logs: {
          create: ordered.map((item, idx) => ({
            planItemId: item.id,
            exerciseId: item.exerciseId,
            orderInSession: idx,
            status: 'pending',
          })),
        },
      },
    });
  }

  const text = renderDailyGreeting({
    name: client.name,
    focus: planDay.focus,
    durationMin: planDay.estimatedDurationMin,
    exerciseCount: planDay.items.filter((i) => i.block === 'exercise').length,
  });

  enqueue({
    trainerId: params.trainerId,
    clientId: params.clientId,
    phone: client.phone,
    sessionId: session.id,
    contentType: 'text',
    text,
    templateKey: 'greeting',
    isTemplateBased: true,
  });
}
