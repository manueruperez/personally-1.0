import { prisma } from '@personally/db';
import { DomainError } from '@personally/core';
import type { CreateClientInput, UpdateClientInput } from '@personally/types';
import type { AuthContext } from '../../middleware/auth.js';
import { enqueue } from '../agent/outbox.js';
import { forceDailyGreeting } from '../../jobs/daily-bootstrap.js';

export type ClientStatusFilter = 'active' | 'paused' | 'archived' | 'all';

export async function listClients(
  ctx: AuthContext,
  opts: { status?: ClientStatusFilter } = {},
) {
  const { status = 'active' } = opts;
  return prisma.client.findMany({
    where: {
      organizationId: ctx.organizationId,
      trainerId: ctx.trainerId,
      ...(status !== 'all' && { status }),
    },
    include: { preferences: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClient(id: string, ctx: AuthContext) {
  return prisma.client.findFirst({
    where: {
      id,
      organizationId: ctx.organizationId,
      trainerId: ctx.trainerId,
    },
    include: { preferences: true },
  });
}

export async function createClient(input: CreateClientInput, ctx: AuthContext) {
  return prisma.client.create({
    data: {
      organizationId: ctx.organizationId,
      trainerId: ctx.trainerId,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      preferences: input.preferences
        ? {
            create: {
              timezone: input.preferences.timezone ?? 'America/Bogota',
              preferredStartTime: input.preferences.preferredStartTime ?? '05:00',
              reminderEnabled: input.preferences.reminderEnabled ?? true,
              silenceAfterFinish: input.preferences.silenceAfterFinish ?? true,
            },
          }
        : undefined,
    },
    include: { preferences: true },
  });
}

export async function updateClient(id: string, input: UpdateClientInput, ctx: AuthContext) {
  return prisma.client.update({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      status: input.status,
      ...(input.preferences && {
        preferences: {
          upsert: {
            create: {
              timezone: input.preferences.timezone ?? 'America/Bogota',
              preferredStartTime: input.preferences.preferredStartTime ?? '05:00',
              reminderEnabled: input.preferences.reminderEnabled ?? true,
              silenceAfterFinish: input.preferences.silenceAfterFinish ?? true,
            },
            update: {
              ...(input.preferences.timezone !== undefined && {
                timezone: input.preferences.timezone,
              }),
              ...(input.preferences.preferredStartTime !== undefined && {
                preferredStartTime: input.preferences.preferredStartTime,
              }),
              ...(input.preferences.reminderEnabled !== undefined && {
                reminderEnabled: input.preferences.reminderEnabled,
              }),
              ...(input.preferences.silenceAfterFinish !== undefined && {
                silenceAfterFinish: input.preferences.silenceAfterFinish,
              }),
            },
          },
        },
      }),
    },
    include: { preferences: true },
  });
}

export async function archiveClient(id: string, ctx: AuthContext) {
  return prisma.client.update({
    where: { id, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    data: { status: 'archived' },
    include: { preferences: true },
  });
}

export async function listClientMessages(
  clientId: string,
  ctx: AuthContext,
  opts: { limit: number; before?: Date },
) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');

  return prisma.message.findMany({
    where: {
      clientId: client.id,
      ...(opts.before && { sentAt: { lt: opts.before } }),
    },
    orderBy: { sentAt: 'desc' },
    take: opts.limit,
  });
}

export async function getTodaySession(clientId: string, ctx: AuthContext) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const session = await prisma.session.findFirst({
    where: { clientId: client.id, scheduledDate: today },
    include: {
      logs: {
        orderBy: { orderInSession: 'asc' },
        include: {
          exercise: { select: { nameEs: true, imageUrl: true } },
          planItem: { select: { block: true, sets: true, reps: true } },
        },
      },
    },
  });
  if (!session) return null;

  return {
    id: session.id,
    status: session.status,
    scheduledDate: session.scheduledDate,
    greetedAt: session.greetedAt,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    itemsTotal: session.itemsTotal,
    itemsDone: session.itemsDone,
    itemsSkipped: session.itemsSkipped,
    logs: session.logs.map((l) => ({
      id: l.id,
      orderInSession: l.orderInSession,
      status: l.status,
      block: l.planItem.block,
      exerciseName: l.exercise.nameEs,
      exerciseImageUrl: l.exercise.imageUrl ?? null,
      sets: l.planItem.sets,
      reps: l.planItem.reps,
      deferCount: l.deferCount,
      notes: l.notes,
    })),
  };
}

export async function resetTodaySession(clientId: string, ctx: AuthContext) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const session = await prisma.session.findFirst({
    where: { clientId: client.id, scheduledDate: today },
  });
  if (!session) return { deleted: false };

  // exercise_logs borran en cascade. messages quedan con sessionId=null (FK opcional).
  await prisma.session.delete({ where: { id: session.id } });
  return { deleted: true, sessionId: session.id };
}

export async function triggerDailyGreeting(clientId: string, ctx: AuthContext) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');
  await forceDailyGreeting(client.id, ctx.trainerId);
  return { queued: true };
}

export async function sendTestMessage(clientId: string, text: string, ctx: AuthContext) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');

  const msg = enqueue({
    trainerId: ctx.trainerId,
    clientId: client.id,
    phone: client.phone,
    contentType: 'text',
    text,
    templateKey: 'test',
    isTemplateBased: false,
  });

  return { queued: true, outboxId: msg.id, enqueuedAt: msg.enqueuedAt };
}
