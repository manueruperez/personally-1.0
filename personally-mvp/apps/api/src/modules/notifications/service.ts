import { prisma } from '@personally/db';
import { DomainError } from '@personally/core';
import type { AuthContext } from '../../middleware/auth.js';
import { enqueue } from '../agent/outbox.js';

export async function listNotifications(
  ctx: AuthContext,
  opts: { unreadOnly?: boolean } = {},
) {
  return prisma.notification.findMany({
    where: {
      trainerId: ctx.trainerId,
      organizationId: ctx.organizationId,
      ...(opts.unreadOnly && { readAt: null }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function markNotificationRead(id: string, ctx: AuthContext) {
  return prisma.notification.update({
    where: { id, trainerId: ctx.trainerId },
    data: { readAt: new Date() },
  });
}

/**
 * Responde al cliente asociado a la notificación con un mensaje custom y
 * marca la notificación como leída.
 */
export async function replyToNotification(
  notificationId: string,
  text: string,
  ctx: AuthContext,
) {
  const notif = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      trainerId: ctx.trainerId,
      organizationId: ctx.organizationId,
    },
  });
  if (!notif) throw new DomainError('NOT_FOUND', 'Notificación no encontrada');

  const meta = (notif.metadata ?? {}) as { clientId?: string };
  if (!meta.clientId) {
    throw new DomainError('VALIDATION_ERROR', 'La notificación no tiene cliente asociado');
  }

  const client = await prisma.client.findUnique({
    where: { id: meta.clientId },
    select: { id: true, phone: true },
  });
  if (!client) throw new DomainError('NOT_FOUND', 'Cliente asociado no encontrado');

  enqueue({
    trainerId: ctx.trainerId,
    clientId: client.id,
    phone: client.phone,
    contentType: 'text',
    text,
    templateKey: 'trainer_reply',
    isTemplateBased: false,
  });

  const updated = await prisma.notification.update({
    where: { id: notif.id },
    data: { readAt: new Date() },
  });

  return { queued: true as const, notification: updated };
}
