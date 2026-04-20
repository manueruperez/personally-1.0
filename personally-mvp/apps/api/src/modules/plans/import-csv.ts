import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { prisma, type Prisma } from '@personally/db';
import { DomainError } from '@personally/core';
import type { AuthContext } from '../../middleware/auth.js';

/**
 * Importador de CSV al formato del demo (`samples/rutina-demo-12-semanas.csv`).
 *
 * Columnas esperadas:
 *   Week, Day, Session, Exercise, Prescription, Rest_s, RPE_Target, Cues, Log_*
 *
 * Comportamiento:
 * - Solo se puede importar sobre planes en status `draft`.
 * - Si el plan ya tenia dias/items, se borran antes de re-importar (idempotente).
 * - Los ejercicios nuevos se crean como `custom` en el catalogo de la org.
 * - Clasificador de bloques:
 *     warmup  → nombre matchea /calentamiento|warmup|movilidad/
 *     cooldown → nombre matchea /cooldown|enfriamiento|flexibilidad|estiramiento/
 *     exercise → el resto
 */

type Row = {
  Week: string;
  Day: string;
  Session: string;
  Exercise: string;
  Prescription: string;
  Rest_s: string;
  RPE_Target: string;
  Cues: string;
};

const DAY_MAP: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 7,
};

export interface ImportSummary {
  daysCreated: number;
  itemsCreated: number;
  exercisesCreated: number;
  exercisesReused: number;
  rowsSkipped: number;
  warnings: string[];
}

export async function importPlanCsv(
  planId: string,
  csv: string,
  ctx: AuthContext,
): Promise<ImportSummary> {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, organizationId: ctx.organizationId, trainerId: ctx.trainerId },
    include: { weeks: true },
  });
  if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado');
  if (plan.status !== 'draft') {
    throw new DomainError(
      'CONFLICT',
      'Solo se puede importar sobre planes en estado draft. Archiva y clona para nueva version.',
    );
  }

  const weekByNumber = new Map(plan.weeks.map((w) => [w.weekNumber, w.id]));

  const rows: Row[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const summary: ImportSummary = {
    daysCreated: 0,
    itemsCreated: 0,
    exercisesCreated: 0,
    exercisesReused: 0,
    rowsSkipped: 0,
    warnings: [],
  };

  // Limpiar dias/items previos (idempotencia)
  await prisma.planDay.deleteMany({
    where: { week: { planId: plan.id } },
  });

  // Agrupar filas por (week, day)
  type ItemSpec = {
    exerciseName: string;
    block: 'warmup' | 'exercise' | 'cooldown';
    sets: number | null;
    reps: string | null;
    restSeconds: number | null;
    rpeTarget: number | null;
    cues: string | null;
    orderIndex: number;
  };
  const groups = new Map<string, { weekNumber: number; dayOfWeek: number; focus: string; items: ItemSpec[] }>();
  const blockCounters = new Map<string, { warmup: number; exercise: number; cooldown: number }>();

  for (const row of rows) {
    const weekNumber = parseInt(row.Week, 10);
    if (!weekNumber || !weekByNumber.has(weekNumber)) {
      summary.rowsSkipped++;
      summary.warnings.push(`Week invalida: "${row.Week}"`);
      continue;
    }

    const dayKey = row.Day?.toLowerCase().trim();
    const dayOfWeek = DAY_MAP[dayKey];
    if (!dayOfWeek) {
      summary.rowsSkipped++;
      summary.warnings.push(`Day invalida: "${row.Day}" en W${row.Week}`);
      continue;
    }

    if (!row.Exercise) {
      summary.rowsSkipped++;
      continue;
    }

    const groupKey = `${weekNumber}:${dayOfWeek}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        weekNumber,
        dayOfWeek,
        focus: row.Session ?? '',
        items: [],
      });
      blockCounters.set(groupKey, { warmup: 0, exercise: 0, cooldown: 0 });
    }

    const block = classifyBlock(row.Exercise);
    const counters = blockCounters.get(groupKey)!;
    const orderIndex = counters[block]++;
    const { sets, reps } = parsePrescription(row.Prescription ?? '');
    const restSeconds = parseFirstNumber(row.Rest_s);
    const rpeTarget = parseRpe(row.RPE_Target);

    groups.get(groupKey)!.items.push({
      exerciseName: row.Exercise.trim(),
      block,
      sets,
      reps,
      restSeconds,
      rpeTarget,
      cues: row.Cues?.trim() || null,
      orderIndex,
    });
  }

  // Find or create exercises (dedup por nombre)
  const uniqueNames = new Set<string>();
  for (const g of groups.values()) g.items.forEach((i) => uniqueNames.add(i.exerciseName));

  const exerciseIdByName = new Map<string, string>();
  const namesArr = Array.from(uniqueNames);

  // Batch fetch existentes (exact match; 1 query)
  const existingExercises = await prisma.exercise.findMany({
    where: {
      nameEs: { in: namesArr },
      OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
    },
    select: { id: true, nameEs: true },
  });
  const existingByName = new Map(existingExercises.map((e) => [e.nameEs, e.id]));

  // Batch insert de los faltantes (1 query)
  const missingNames = namesArr.filter((n) => !existingByName.has(n));
  const newExerciseRecords = missingNames.map((name) => ({
    id: randomUUID(),
    source: 'custom' as const,
    nameEs: name,
    organizationId: ctx.organizationId,
    createdBy: ctx.trainerId,
    muscleprimary: [],
    muscleSecondary: [],
    equipment: [],
  }));
  if (newExerciseRecords.length > 0) {
    await prisma.exercise.createMany({ data: newExerciseRecords });
  }

  for (const name of uniqueNames) {
    const existingId = existingByName.get(name);
    if (existingId) {
      exerciseIdByName.set(name, existingId);
      summary.exercisesReused++;
    } else {
      const created = newExerciseRecords.find((r) => r.nameEs === name)!;
      exerciseIdByName.set(name, created.id);
      summary.exercisesCreated++;
    }
  }

  // Pre-generar UUIDs para hacer solo 2 batch inserts (evita N+1 sobre el pooler)
  const daysWithIds = Array.from(groups.values()).map((g) => ({
    id: randomUUID(),
    weekNumber: g.weekNumber,
    dayOfWeek: g.dayOfWeek,
    focus: g.focus,
    items: g.items,
  }));

  const daysData: Prisma.PlanDayCreateManyInput[] = daysWithIds.map((d) => ({
    id: d.id,
    planWeekId: weekByNumber.get(d.weekNumber)!,
    dayOfWeek: d.dayOfWeek,
    focus: d.focus || null,
  }));

  const itemsData: Prisma.PlanItemCreateManyInput[] = daysWithIds.flatMap((d) =>
    d.items.map((it) => ({
      planDayId: d.id,
      block: it.block,
      orderIndex: it.orderIndex,
      exerciseId: exerciseIdByName.get(it.exerciseName)!,
      sets: it.sets,
      reps: it.reps,
      restSeconds: it.restSeconds,
      rpeTarget: it.rpeTarget,
      cues: it.cues,
    })),
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.planDay.createMany({ data: daysData });
      await tx.planItem.createMany({ data: itemsData });
    },
    { timeout: 60000, maxWait: 10000 },
  );

  summary.daysCreated = daysData.length;
  summary.itemsCreated = itemsData.length;

  return summary;
}

function classifyBlock(exerciseName: string): 'warmup' | 'exercise' | 'cooldown' {
  const n = exerciseName.toLowerCase();
  if (/calentamiento|warmup|movilidad|activaci[oó]n/i.test(n)) return 'warmup';
  if (/cooldown|enfriamiento|flexibilidad|estiramiento/i.test(n)) return 'cooldown';
  return 'exercise';
}

function parsePrescription(raw: string): { sets: number | null; reps: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { sets: null, reps: null };
  const m = trimmed.match(/^(\d+)\s*x\s*(.+)$/i);
  if (m) {
    return { sets: parseInt(m[1]!, 10), reps: m[2]!.trim() };
  }
  return { sets: null, reps: trimmed };
}

function parseFirstNumber(raw: string): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseRpe(raw: string): number | null {
  if (!raw) return null;
  const n = parseFirstNumber(raw);
  if (n == null) return null;
  return Math.min(Math.max(n, 1), 10);
}
