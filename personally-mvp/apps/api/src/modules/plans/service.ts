import { prisma } from '@personally/db';
import { DomainError, MIN_PLAN_DURATION_DAYS } from '@personally/core';
import type {
  CreatePlanDraftInput,
  CreatePlanFullInput,
  UpdatePlanInput,
} from '@personally/types';
import type { AuthContext } from '../../middleware/auth.js';
import { enqueue } from '../agent/outbox.js';
import { logger } from '../../lib/logger.js';

export async function listPlansByClient(clientId: string, ctx: AuthContext) {
  return prisma.plan.findMany({
    where: {
      clientId,
      organizationId: ctx.organizationId,
      trainerId: ctx.trainerId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPlan(id: string, ctx: AuthContext) {
  return prisma.plan.findFirst({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    include: {
      client: true,
      weeks: {
        orderBy: { weekNumber: 'asc' },
        include: {
          days: {
            orderBy: { dayOfWeek: 'asc' },
            include: {
              items: {
                orderBy: [{ block: 'asc' }, { orderIndex: 'asc' }],
                include: { exercise: true },
              },
            },
          },
        },
      },
    },
  });
}

async function validateNoActivePlan(clientId: string) {
  const active = await prisma.plan.findFirst({
    where: { clientId, status: 'active' },
  });
  if (active) throw new DomainError('CLIENT_HAS_ACTIVE_PLAN', 'El cliente ya tiene un plan activo');
}

async function validateClientAndDuration(
  clientId: string,
  startDate: Date,
  endDate: Date,
  ctx: AuthContext,
) {
  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (durationDays < MIN_PLAN_DURATION_DAYS) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `El plan debe durar al menos ${MIN_PLAN_DURATION_DAYS} dias`,
    );
  }
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');
}

/**
 * Crea un plan "borrador": metadata + N semanas vacias (sin dias ni items).
 * El resto se llena despues via CSV import o editor.
 */
export async function createPlanDraft(
  clientId: string,
  input: CreatePlanDraftInput,
  ctx: AuthContext,
) {
  await validateClientAndDuration(clientId, input.startDate, input.endDate, ctx);
  await validateNoActivePlan(clientId);

  return prisma.plan.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      trainerId: ctx.trainerId,
      name: input.name,
      goal: input.goal,
      daysPerWeek: input.daysPerWeek,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'draft',
      weeks: {
        create: Array.from({ length: input.totalWeeks }, (_, i) => ({
          weekNumber: i + 1,
          phase: 'load' as const,
        })),
      },
    },
    include: {
      weeks: { orderBy: { weekNumber: 'asc' } },
    },
  });
}

/**
 * Crea un plan completo con todo el arbol (usado por importadores).
 */
export async function createPlanFull(
  clientId: string,
  input: CreatePlanFullInput,
  ctx: AuthContext,
) {
  await validateClientAndDuration(clientId, input.startDate, input.endDate, ctx);
  await validateNoActivePlan(clientId);

  return prisma.plan.create({
    data: {
      organizationId: ctx.organizationId,
      clientId,
      trainerId: ctx.trainerId,
      name: input.name,
      goal: input.goal,
      daysPerWeek: input.daysPerWeek,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'draft',
      weeks: {
        create: input.weeks.map((w) => ({
          weekNumber: w.weekNumber,
          phase: w.phase,
          notes: w.notes,
          days: {
            create: w.days.map((d) => ({
              dayOfWeek: d.dayOfWeek,
              focus: d.focus,
              estimatedDurationMin: d.estimatedDurationMin,
              isRestDay: d.isRestDay,
              notes: d.notes,
              items: {
                create: d.items.map((item) => ({
                  block: item.block,
                  orderIndex: item.orderIndex,
                  exerciseId: item.exerciseId,
                  sets: item.sets,
                  reps: item.reps,
                  restSeconds: item.restSeconds,
                  tempo: item.tempo,
                  loadSuggestion: item.loadSuggestion,
                  rpeTarget: item.rpeTarget,
                  cues: item.cues,
                  notes: item.notes,
                  groupId: item.groupId,
                  groupType: item.groupType,
                })),
              },
            })),
          },
        })),
      },
    },
  });
}

export async function updatePlan(id: string, input: UpdatePlanInput, ctx: AuthContext) {
  return prisma.plan.update({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    data: input,
  });
}

export async function activatePlan(id: string, ctx: AuthContext) {
  const plan = await prisma.plan.findFirst({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    include: {
      client: { include: { preferences: true } },
      trainer: true,
      weeks: { select: { id: true } },
    },
  });
  if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado');
  await validateNoActivePlan(plan.clientId);

  const updated = await prisma.plan.update({
    where: { id },
    data: { status: 'active' },
  });

  // Encolar mensaje de bienvenida al cliente
  try {
    const firstName = plan.client.name.split(' ')[0] ?? plan.client.name;
    const hora = plan.client.preferences?.preferredStartTime ?? '05:00';
    const totalWeeks = plan.weeks.length;
    const text = [
      `¡Hola ${firstName}! 💪`,
      ``,
      `Tu entrenador activó tu plan: *${plan.name}*`,
      `📆 ${plan.daysPerWeek} días/semana · ${totalWeeks} semanas`,
      ``,
      `Todos los días a las ${hora} te voy a enviar la rutina. Respondé *iniciar* para arrancar.`,
    ].join('\n');

    enqueue({
      trainerId: ctx.trainerId,
      clientId: plan.client.id,
      phone: plan.client.phone,
      contentType: 'text',
      text,
      templateKey: 'plan_activated',
      isTemplateBased: true,
    });
  } catch (err) {
    logger.warn({ err, planId: id }, 'No se pudo encolar mensaje de activacion');
  }

  return updated;
}

export async function revertPlanToDraft(id: string, ctx: AuthContext) {
  const plan = await prisma.plan.findFirst({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado');
  if (plan.status === 'draft') return plan;

  // No permitir revertir si ya hay sesiones ejecutadas contra este plan
  const executedSessions = await prisma.session.count({
    where: {
      clientId: plan.clientId,
      planDay: { week: { planId: plan.id } },
      status: { in: ['in_progress', 'completed', 'partial', 'abandoned'] },
    },
  });
  if (executedSessions > 0) {
    throw new DomainError(
      'CONFLICT',
      `No se puede revertir: el plan ya tiene ${executedSessions} sesion(es) ejecutada(s)`,
    );
  }

  return prisma.plan.update({ where: { id }, data: { status: 'draft' } });
}

export async function archivePlan(id: string, ctx: AuthContext) {
  return prisma.plan.update({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    data: { status: 'archived' },
  });
}

export interface AddPlanItemInput {
  exerciseId: string;
  block: 'warmup' | 'exercise' | 'cooldown';
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  rpeTarget?: number | null;
  cues?: string | null;
  notes?: string | null;
}

export async function addPlanItem(dayId: string, input: AddPlanItemInput, ctx: AuthContext) {
  const day = await prisma.planDay.findFirst({
    where: {
      id: dayId,
      planWeek: {
        plan: { organizationId: ctx.organizationId, trainerId: ctx.trainerId },
      },
    },
    include: {
      items: { where: { block: input.block }, orderBy: { orderIndex: 'desc' }, take: 1 },
      planWeek: { include: { plan: true } },
    },
  });
  if (!day) throw new DomainError('NOT_FOUND', 'Día de plan no encontrado');
  if (day.planWeek.plan.status === 'archived') {
    throw new DomainError('CONFLICT', 'No se pueden agregar items a un plan archivado');
  }

  const target = await prisma.exercise.findFirst({
    where: {
      id: input.exerciseId,
      OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
    },
  });
  if (!target) throw new DomainError('NOT_FOUND', 'Ejercicio no encontrado');

  const nextOrder = (day.items[0]?.orderIndex ?? -1) + 1;

  return prisma.planItem.create({
    data: {
      planDayId: dayId,
      exerciseId: input.exerciseId,
      block: input.block,
      orderIndex: nextOrder,
      sets: input.sets ?? null,
      reps: input.reps ?? null,
      restSeconds: input.restSeconds ?? null,
      rpeTarget: input.rpeTarget ?? null,
      cues: input.cues ?? null,
      notes: input.notes ?? null,
    },
    include: { exercise: { select: { id: true, nameEs: true, imageUrl: true } } },
  });
}

export async function deletePlanItem(itemId: string, ctx: AuthContext) {
  const item = await prisma.planItem.findFirst({
    where: {
      id: itemId,
      planDay: {
        planWeek: {
          plan: { organizationId: ctx.organizationId, trainerId: ctx.trainerId },
        },
      },
    },
    include: { planDay: { include: { planWeek: { include: { plan: true } } } } },
  });
  if (!item) throw new DomainError('NOT_FOUND', 'Item no encontrado');
  if (item.planDay.planWeek.plan.status === 'archived') {
    throw new DomainError('CONFLICT', 'No se pueden borrar items de un plan archivado');
  }
  await prisma.planItem.delete({ where: { id: itemId } });
  return { deleted: true as const };
}

export interface UpdatePlanItemInput {
  exerciseId?: string;
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  rpeTarget?: number | null;
  cues?: string | null;
  notes?: string | null;
  loadSuggestion?: string | null;
}

export async function updatePlanItem(
  itemId: string,
  input: UpdatePlanItemInput,
  ctx: AuthContext,
) {
  // Verificar ownership via plan → trainer/org
  const item = await prisma.planItem.findFirst({
    where: {
      id: itemId,
      planDay: {
        planWeek: {
          plan: {
            organizationId: ctx.organizationId,
            trainerId: ctx.trainerId,
          },
        },
      },
    },
    include: { planDay: { include: { planWeek: { include: { plan: true } } } } },
  });
  if (!item) throw new DomainError('NOT_FOUND', 'Item de plan no encontrado');

  const planStatus = item.planDay.planWeek.plan.status;
  if (planStatus === 'archived') {
    throw new DomainError('CONFLICT', 'No se pueden editar items de un plan archivado');
  }

  // Swap de ejercicio: validar que el ejercicio destino existe y es accesible
  // (público = sin organizationId, o misma org que el trainer).
  if (input.exerciseId !== undefined) {
    const target = await prisma.exercise.findFirst({
      where: {
        id: input.exerciseId,
        OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
      },
    });
    if (!target) {
      throw new DomainError('NOT_FOUND', 'Ejercicio destino no encontrado o no accesible');
    }
  }

  return prisma.planItem.update({
    where: { id: itemId },
    data: {
      ...(input.exerciseId !== undefined && { exerciseId: input.exerciseId }),
      ...(input.sets !== undefined && { sets: input.sets }),
      ...(input.reps !== undefined && { reps: input.reps }),
      ...(input.restSeconds !== undefined && { restSeconds: input.restSeconds }),
      ...(input.rpeTarget !== undefined && { rpeTarget: input.rpeTarget }),
      ...(input.cues !== undefined && { cues: input.cues }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.loadSuggestion !== undefined && { loadSuggestion: input.loadSuggestion }),
    },
    include: { exercise: { select: { id: true, nameEs: true, imageUrl: true } } },
  });
}

export async function addPlanWeek(planId: string, ctx: AuthContext) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    include: { weeks: { orderBy: { weekNumber: 'desc' }, take: 1 } },
  });
  if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado');
  if (plan.status !== 'draft') {
    throw new DomainError(
      'CONFLICT',
      'Solo se pueden agregar semanas a planes en estado draft',
    );
  }
  const maxWeek = plan.weeks[0]?.weekNumber ?? 0;
  const nextNumber = maxWeek + 1;
  if (nextNumber > 52) {
    throw new DomainError('VALIDATION_ERROR', 'Maximo 52 semanas por plan');
  }
  return prisma.planWeek.create({
    data: { planId, weekNumber: nextNumber, phase: 'load' },
  });
}

export async function deletePlanWeek(
  planId: string,
  weekNumber: number,
  ctx: AuthContext,
) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado');
  if (plan.status !== 'draft') {
    throw new DomainError(
      'CONFLICT',
      'Solo se pueden eliminar semanas de planes en estado draft',
    );
  }
  const week = await prisma.planWeek.findFirst({
    where: { planId, weekNumber },
  });
  if (!week) throw new DomainError('NOT_FOUND', 'Semana no encontrada');

  // 1) Borrar la semana (cascade a plan_days / plan_items via FK)
  // 2) Renumerar las subsiguientes en un solo UPDATE para mantener 1..N contiguo
  await prisma.$transaction([
    prisma.planWeek.delete({ where: { id: week.id } }),
    prisma.planWeek.updateMany({
      where: { planId, weekNumber: { gt: weekNumber } },
      data: { weekNumber: { decrement: 1 } },
    }),
  ]);

  return { deletedWeekNumber: weekNumber };
}
