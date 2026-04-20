import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '../index.js';

/**
 * Carga el catalogo de `yuhonas/free-exercise-db` (dominio publico) en la tabla `exercises`.
 *
 * Fuente: https://github.com/yuhonas/free-exercise-db
 * - ~800 ejercicios con nombres EN, musculos, equipamiento, instrucciones, imagenes
 * - Imagenes: PNGs alojados en el mismo repo (NO son GIFs animados)
 *
 * Idempotente: solo inserta los que no existan por (source, source_ref).
 */

const JSON_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

interface RawExercise {
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
  id: string;
}

async function main() {
  console.log('📥 Descargando catalogo de free-exercise-db...');
  const res = await fetch(JSON_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const exercises = (await res.json()) as RawExercise[];
  console.log(`  ↳ ${exercises.length} ejercicios en el JSON`);

  console.log('🔍 Buscando existentes en DB...');
  const existing = await prisma.exercise.findMany({
    where: { source: 'free_exercise_db' },
    select: { sourceRef: true },
  });
  const existingRefs = new Set(existing.map((e) => e.sourceRef));
  console.log(`  ↳ ${existingRefs.size} ya cargados`);

  const toInsert: Prisma.ExerciseCreateManyInput[] = [];
  for (const ex of exercises) {
    if (existingRefs.has(ex.id)) continue;

    const images = (ex.images ?? []).map((p) => `${IMG_BASE}/${p}`);
    const instructions = (ex.instructions ?? []).join('\n\n');

    toInsert.push({
      id: randomUUID(),
      source: 'free_exercise_db',
      sourceRef: ex.id,
      nameEs: ex.name, // mismo que EN hasta que se traduzca
      nameEn: ex.name,
      muscleprimary: ex.primaryMuscles ?? [],
      muscleSecondary: ex.secondaryMuscles ?? [],
      equipment: ex.equipment ? [ex.equipment] : [],
      level: ex.level,
      mechanic: ex.mechanic,
      instructions: instructions || null,
      imageUrl: images[0] ?? null,
    });
  }

  if (toInsert.length === 0) {
    console.log('✅ Nada nuevo que insertar');
    return;
  }

  console.log(`💾 Insertando ${toInsert.length} ejercicios...`);
  // Insertar en batches de 200 para no exceder limites del pooler
  const BATCH = 200;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    await prisma.exercise.createMany({ data: chunk });
    console.log(`  ↳ ${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}`);
  }

  console.log('✅ Catalogo cargado');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
