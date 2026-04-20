import { z } from 'zod';
import { uuid } from './common.js';

export const exerciseSource = z.enum(['free_exercise_db', 'custom', 'exercisedb']);

export const exerciseSchema = z.object({
  id: uuid,
  source: exerciseSource,
  sourceRef: z.string().nullable(),
  nameEs: z.string(),
  nameEn: z.string().nullable(),
  muscleprimary: z.array(z.string()),
  muscleSecondary: z.array(z.string()),
  equipment: z.array(z.string()),
  level: z.string().nullable(),
  mechanic: z.string().nullable(),
  instructions: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  videoUrl: z.string().url().nullable(),
});

export const createExerciseInput = z.object({
  nameEs: z.string().min(1).max(120),
  nameEn: z.string().max(120).optional(),
  muscleprimary: z.array(z.string()).default([]),
  muscleSecondary: z.array(z.string()).default([]),
  equipment: z.array(z.string()).default([]),
  level: z.string().max(30).optional(),
  mechanic: z.string().max(30).optional(),
  instructions: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
});

export const searchExercisesQuery = z.object({
  q: z.string().optional(),
  muscle: z.string().optional(),
  equipment: z.string().optional(),
  level: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Exercise = z.infer<typeof exerciseSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseInput>;
export type SearchExercisesQuery = z.infer<typeof searchExercisesQuery>;
