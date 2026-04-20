import { prisma } from '../index.js';

/**
 * Seed del catalogo de ejercicios.
 *
 * Estrategia:
 * 1. Clonar el repo `yuhonas/free-exercise-db` en /tmp o leer un JSON pre-descargado
 * 2. Parsear cada entry e insertarla en `exercises` con source='free_exercise_db'
 * 3. Ejecutar traduccion masiva ES mediante un script aparte (post-seed)
 *
 * Por ahora este script inserta un set minimo de ejemplo para que los
 * tests end-to-end no se caigan. La carga real debe hacerse con un script
 * dedicado (scripts/load-free-exercise-db.ts - pendiente).
 */
export async function seedExercises() {
  const count = await prisma.exercise.count();
  if (count > 0) {
    console.log(`  ↳ exercises ya tiene ${count} filas, skip`);
    return;
  }

  const samples = [
    {
      source: 'free_exercise_db' as const,
      sourceRef: 'Squats',
      nameEs: 'Sentadilla con barra',
      nameEn: 'Barbell Squat',
      muscleprimary: ['cuadriceps'],
      muscleSecondary: ['gluteos', 'isquiotibiales', 'core'],
      equipment: ['barra', 'rack'],
      level: 'intermediate',
      mechanic: 'compound',
      instructions: 'Coloca la barra sobre los trapecios altos...',
    },
    {
      source: 'free_exercise_db' as const,
      sourceRef: 'Bench_Press',
      nameEs: 'Press de banca',
      nameEn: 'Bench Press',
      muscleprimary: ['pecho'],
      muscleSecondary: ['triceps', 'hombros'],
      equipment: ['barra', 'banco'],
      level: 'intermediate',
      mechanic: 'compound',
      instructions: 'Acostado en el banco, desciende la barra al pecho...',
    },
    {
      source: 'free_exercise_db' as const,
      sourceRef: 'Deadlift',
      nameEs: 'Peso muerto',
      nameEn: 'Deadlift',
      muscleprimary: ['espalda baja', 'isquiotibiales'],
      muscleSecondary: ['gluteos', 'trapecios', 'core'],
      equipment: ['barra'],
      level: 'advanced',
      mechanic: 'compound',
      instructions: 'Pies al ancho de caderas, barra pegada a las espinillas...',
    },
    {
      source: 'free_exercise_db' as const,
      sourceRef: 'Plank',
      nameEs: 'Plancha abdominal',
      nameEn: 'Plank',
      muscleprimary: ['core'],
      muscleSecondary: ['hombros', 'gluteos'],
      equipment: ['peso corporal'],
      level: 'beginner',
      mechanic: 'isolation',
      instructions: 'Apoyate en antebrazos y puntas de pies, cuerpo recto...',
    },
    {
      source: 'free_exercise_db' as const,
      sourceRef: 'Jumping_Jacks',
      nameEs: 'Saltos de tijera',
      nameEn: 'Jumping Jacks',
      muscleprimary: ['cardio'],
      muscleSecondary: [],
      equipment: ['peso corporal'],
      level: 'beginner',
      mechanic: 'cardio',
      instructions: 'Salta abriendo piernas y brazos simultaneamente...',
    },
  ];

  await prisma.exercise.createMany({ data: samples });
  console.log(`  ↳ ${samples.length} ejercicios sample insertados`);
}
