import { z } from 'zod';
import { uuid } from './common.js';

export const notificationType = z.enum([
  'change_request',
  'no_response_n_days',
  'pain_report',
  'agent_offline',
  'agent_reconnected',
  'plan_expiring',
]);

export const notificationSchema = z.object({
  id: uuid,
  trainerId: uuid,
  type: notificationType,
  title: z.string(),
  body: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type NotificationType = z.infer<typeof notificationType>;
export type Notification = z.infer<typeof notificationSchema>;
