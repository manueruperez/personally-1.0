import { z } from 'zod';
import { uuid } from './common.js';

export const phoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Debe ser un numero E.164, ej. +573001234567');

export const timeHHmm = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:mm');

export const clientStatus = z.enum(['active', 'paused', 'archived']);

export const clientPreferenceSchema = z.object({
  timezone: z.string().default('America/Bogota'),
  preferredStartTime: timeHHmm.default('05:00'),
  reminderEnabled: z.boolean().default(true),
  silenceAfterFinish: z.boolean().default(true),
});

export const clientSchema = z.object({
  id: uuid,
  organizationId: uuid,
  trainerId: uuid,
  name: z.string().min(1),
  phone: phoneE164,
  email: z.string().email().optional().nullable(),
  status: clientStatus,
  preferences: clientPreferenceSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createClientInput = z.object({
  name: z.string().min(1).max(120),
  phone: phoneE164,
  email: z.string().email().optional(),
  preferences: clientPreferenceSchema.partial().optional(),
});

export const updateClientInput = createClientInput.partial().extend({
  status: clientStatus.optional(),
});

export type Client = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientInput>;
export type UpdateClientInput = z.infer<typeof updateClientInput>;
export type ClientPreference = z.infer<typeof clientPreferenceSchema>;
