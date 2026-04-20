import { prisma, type Prisma } from '@personally/db';
import type { CreateExerciseInput, SearchExercisesQuery } from '@personally/types';

export interface SearchContext {
  organizationId: string;
}

export async function searchExercises(query: SearchExercisesQuery, ctx: SearchContext) {
  const { q, muscle, equipment, level, page, pageSize } = query;

  const where: Prisma.ExerciseWhereInput = {
    OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
    ...(q && {
      OR: [
        { nameEs: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
      ],
    }),
    ...(muscle && { muscleprimary: { has: muscle } }),
    ...(equipment && { equipment: { has: equipment } }),
    ...(level && { level }),
  };

  const [items, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { nameEs: 'asc' },
    }),
    prisma.exercise.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function findExerciseById(id: string, ctx: SearchContext) {
  return prisma.exercise.findFirst({
    where: {
      id,
      OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
    },
  });
}

export async function createCustomExercise(
  input: CreateExerciseInput,
  ctx: { organizationId: string; trainerId: string },
) {
  return prisma.exercise.create({
    data: {
      ...input,
      source: 'custom',
      organizationId: ctx.organizationId,
      createdBy: ctx.trainerId,
    },
  });
}
