/**
 * Traducción manual del catálogo top 50+ free-exercise-db al español.
 *
 * Política:
 *  - Solo tocamos ejercicios `source = 'free_exercise_db'`.
 *  - Solo actualizamos cuando `nameEs` sigue siendo idéntico a `nameEn`
 *    (señal de que el loader inicial no tradujo).
 *  - El match contra la tabla es case-insensitive por `nameEn`.
 *
 * Ejecución: `pnpm --filter @personally/db exec tsx src/scripts/translate-catalog.ts`
 */

import { prisma } from '../index.js';

// Mapa nameEn → nameEs. Priorizamos los levantamientos más comunes en planes
// reales de trainers. Si un ejercicio no está acá, queda en inglés y puede
// traducirse manualmente después.
export const TRANSLATIONS: Record<string, string> = {
  // Sentadilla
  'squat': 'Sentadilla',
  'barbell squat': 'Sentadilla con barra',
  'front squat': 'Sentadilla frontal',
  'goblet squat': 'Sentadilla copa (goblet)',
  'bulgarian split squat': 'Sentadilla búlgara',
  'hack squat': 'Hack squat',
  'box squat': 'Sentadilla a cajón',
  'split squat': 'Sentadilla dividida',
  'bodyweight squat': 'Sentadilla sin peso',

  // Peso muerto
  'deadlift': 'Peso muerto',
  'barbell deadlift': 'Peso muerto con barra',
  'romanian deadlift': 'Peso muerto rumano',
  'sumo deadlift': 'Peso muerto sumo',
  'stiff-legged deadlift': 'Peso muerto pierna rígida',
  'single leg deadlift': 'Peso muerto a una pierna',

  // Empuje horizontal
  'bench press': 'Press de banca',
  'barbell bench press': 'Press de banca con barra',
  'incline bench press': 'Press inclinado',
  'incline dumbbell press': 'Press inclinado con mancuernas',
  'decline bench press': 'Press declinado',
  'dumbbell bench press': 'Press de banca con mancuernas',
  'close-grip bench press': 'Press de banca agarre cerrado',
  'push-up': 'Lagartija / flexión',
  'pushup': 'Lagartija / flexión',
  'push up': 'Lagartija / flexión',

  // Remos / Jalones
  'bent over row': 'Remo inclinado',
  'bent-over row': 'Remo inclinado',
  'barbell row': 'Remo con barra',
  'dumbbell row': 'Remo con mancuerna',
  'seated cable row': 'Remo sentado (polea)',
  'pendlay row': 'Remo Pendlay',
  't-bar row': 'Remo T',
  'lat pulldown': 'Jalón al pecho',
  'pull up': 'Dominada',
  'pullup': 'Dominada',
  'pull-up': 'Dominada',
  'chin up': 'Dominada supina (chin up)',
  'chin-up': 'Dominada supina (chin up)',
  'face pull': 'Face pull (polea)',

  // Empuje vertical / hombros
  'overhead press': 'Press militar',
  'military press': 'Press militar',
  'shoulder press': 'Press de hombro',
  'dumbbell shoulder press': 'Press de hombro con mancuernas',
  'seated dumbbell press': 'Press sentado con mancuernas',
  'arnold press': 'Press Arnold',
  'lateral raise': 'Elevación lateral',
  'dumbbell lateral raise': 'Elevación lateral con mancuernas',
  'front raise': 'Elevación frontal',
  'rear delt fly': 'Aperturas posteriores',

  // Bíceps / Tríceps
  'bicep curl': 'Curl de bíceps',
  'barbell curl': 'Curl con barra',
  'dumbbell curl': 'Curl con mancuernas',
  'hammer curl': 'Curl martillo',
  'preacher curl': 'Curl predicador',
  'concentration curl': 'Curl concentrado',
  'tricep extension': 'Extensión de tríceps',
  'tricep pushdown': 'Tríceps con polea',
  'triceps pushdown': 'Tríceps con polea',
  'skull crusher': 'Press francés (skull crusher)',
  'dip': 'Fondos (dips)',
  'tricep dip': 'Fondos de tríceps',

  // Piernas (accesorios)
  'leg press': 'Prensa',
  'leg extension': 'Extensión de cuádriceps',
  'leg curl': 'Curl de isquios',
  'hip thrust': 'Hip thrust / Puente',
  'glute bridge': 'Puente de glúteo',
  'calf raise': 'Elevación de pantorrilla',
  'standing calf raise': 'Pantorrilla de pie',
  'seated calf raise': 'Pantorrilla sentado',
  'walking lunge': 'Zancadas caminando',
  'lunge': 'Zancada',
  'reverse lunge': 'Zancada inversa',
  'step up': 'Step-ups',
  'step-up': 'Step-ups',

  // Core
  'plank': 'Plancha',
  'side plank': 'Plancha lateral',
  'russian twist': 'Russian twist',
  'hanging leg raise': 'Elevación de piernas colgado',
  'crunch': 'Crunch abdominal',
  'sit up': 'Abdominales (sit-up)',
  'sit-up': 'Abdominales (sit-up)',
  'dead bug': 'Dead bug',
  'bird dog': 'Bird dog',
  'pallof press': 'Pallof press',
  'ab wheel rollout': 'Rueda abdominal',
  'mountain climber': 'Escaladores',

  // Cardio / warmup
  'jumping jack': 'Saltos de tijera (jumping jacks)',
  'burpee': 'Burpee',
  'jump rope': 'Saltar cuerda',
  'high knees': 'Rodillas altas',
};

async function main() {
  const rows = await prisma.exercise.findMany({
    where: { source: 'free_exercise_db' },
    select: { id: true, nameEn: true, nameEs: true },
  });

  let updated = 0;
  let skipped = 0;
  let notMapped = 0;

  for (const row of rows) {
    const enKey = row.nameEn?.trim().toLowerCase() ?? '';
    const translated = TRANSLATIONS[enKey];

    if (!translated) {
      // Sólo contamos como "no mapeado" si además sigue sin traducir
      if (row.nameEs && row.nameEn && row.nameEs.trim() === row.nameEn.trim()) {
        notMapped++;
      }
      continue;
    }

    const esIsSameAsEn =
      row.nameEs && row.nameEn && row.nameEs.trim().toLowerCase() === row.nameEn.trim().toLowerCase();
    const esIsBlank = !row.nameEs || row.nameEs.trim() === '';

    if (!esIsSameAsEn && !esIsBlank) {
      // Ya tiene traducción custom; no la pisamos.
      skipped++;
      continue;
    }

    await prisma.exercise.update({
      where: { id: row.id },
      data: { nameEs: translated },
    });
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        totalFree: rows.length,
        updated,
        skipped,
        notMapped,
        mapSize: Object.keys(TRANSLATIONS).length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
