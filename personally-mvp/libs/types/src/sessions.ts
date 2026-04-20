import { z } from 'zod';
import { uuid } from './common.js';

export const sessionStatus = z.enum([
  'scheduled',
  'greeted',
  'in_progress',
  'completed',
  'partial',
  'abandoned',
  'missed',
]);

export const logStatus = z.enum([
  'pending',
  'presented',
  'done',
  'skipped',
  'changed',
  'missed',
]);

export const sessionSchema = z.object({
  id: uuid,
  clientId: uuid,
  planDayId: uuid,
  scheduledDate: z.coerce.date(),
  status: sessionStatus,
  greetedAt: z.coerce.date().nullable(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  itemsTotal: z.number().int(),
  itemsPresented: z.number().int(),
  itemsDone: z.number().int(),
  itemsSkipped: z.number().int(),
  completionRate: z.number().min(0).max(1),
});

export const advanceSessionInput = z.object({
  exerciseLogId: uuid.optional(),
});

export const skipSessionInput = z.object({
  exerciseLogId: uuid,
  reason: z.string().max(200).optional(),
});

export const changeRequestInput = z.object({
  exerciseLogId: uuid,
  reason: z.string().max(200).optional(),
});

export const finishSessionInput = z.object({
  notes: z.string().max(500).optional(),
});

export const logExecutionInput = z.object({
  setsDone: z.number().int().min(0).optional(),
  repsDone: z.string().max(40).optional(),
  loadUsed: z.string().max(40).optional(),
  rpeReported: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

export type SessionStatus = z.infer<typeof sessionStatus>;
export type LogStatus = z.infer<typeof logStatus>;
export type Session = z.infer<typeof sessionSchema>;
export type AdvanceSessionInput = z.infer<typeof advanceSessionInput>;
export type SkipSessionInput = z.infer<typeof skipSessionInput>;
export type ChangeRequestInput = z.infer<typeof changeRequestInput>;
export type FinishSessionInput = z.infer<typeof finishSessionInput>;
export type LogExecutionInput = z.infer<typeof logExecutionInput>;
