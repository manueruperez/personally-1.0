import { z } from 'zod';
import { uuid } from './common.js';

export const planStatus = z.enum(['draft', 'active', 'archived']);
export const weekPhase = z.enum(['load', 'deload', 'test', 'custom']);
export const blockType = z.enum(['warmup', 'exercise', 'cooldown']);
export const groupType = z.enum(['superset', 'circuit', 'giant_set']);

export const planItemInput = z.object({
  block: blockType,
  orderIndex: z.number().int().min(0),
  exerciseId: uuid,
  sets: z.number().int().min(1).max(20).optional().nullable(),
  reps: z.string().max(20).optional().nullable(),
  restSeconds: z.number().int().min(0).max(600).optional().nullable(),
  tempo: z.string().max(20).optional().nullable(),
  loadSuggestion: z.string().max(40).optional().nullable(),
  rpeTarget: z.number().int().min(1).max(10).optional().nullable(),
  cues: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  groupId: uuid.optional().nullable(),
  groupType: groupType.optional().nullable(),
});

export const planDayInput = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  focus: z.string().max(120).optional(),
  estimatedDurationMin: z.number().int().min(5).max(240).optional(),
  isRestDay: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  items: z.array(planItemInput),
});

export const planWeekInput = z.object({
  weekNumber: z.number().int().min(1).max(52),
  phase: weekPhase.default('load'),
  notes: z.string().max(500).optional(),
  days: z.array(planDayInput),
});

/**
 * Draft: crea un plan con solo metadata + N weeks vacias.
 * Los dias y items se agregan despues (via CSV import o editor).
 */
export const createPlanDraftInput = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().max(500).optional(),
  daysPerWeek: z.number().int().min(3).max(5),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  totalWeeks: z.number().int().min(12).max(52).default(12),
});

/**
 * Full: crea un plan completo con todo el arbol (usado por importadores).
 */
export const createPlanFullInput = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().max(500).optional(),
  daysPerWeek: z.number().int().min(3).max(5),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  weeks: z.array(planWeekInput).min(12, 'El plan debe tener al menos 12 semanas'),
});

export const updatePlanInput = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: z.string().max(500).optional(),
  status: planStatus.optional(),
});

export type CreatePlanDraftInput = z.infer<typeof createPlanDraftInput>;
export type CreatePlanFullInput = z.infer<typeof createPlanFullInput>;
export type UpdatePlanInput = z.infer<typeof updatePlanInput>;
export type PlanItemInput = z.infer<typeof planItemInput>;
export type PlanDayInput = z.infer<typeof planDayInput>;
export type PlanWeekInput = z.infer<typeof planWeekInput>;
