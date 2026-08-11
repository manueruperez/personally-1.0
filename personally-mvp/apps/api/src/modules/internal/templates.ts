export interface ExerciseCardContext {
  order: number;
  total: number;
  block: 'warmup' | 'exercise' | 'cooldown';
  name: string;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  rpeTarget: number | null;
  cues: string | null;
}

const BLOCK_LABEL: Record<'warmup' | 'exercise' | 'cooldown', string> = {
  warmup: '🔥 Calentamiento',
  exercise: '🏋️ Ejercicio',
  cooldown: '🧘 Cooldown',
};

export function renderExerciseCard(ctx: ExerciseCardContext): string {
  const lines: string[] = [];
  lines.push(`${ctx.order}/${ctx.total} · ${BLOCK_LABEL[ctx.block]}`);
  lines.push(`*${ctx.name}*`);

  const prescription: string[] = [];
  if (ctx.sets != null && ctx.reps) prescription.push(`${ctx.sets}x${ctx.reps}`);
  else if (ctx.reps) prescription.push(ctx.reps);
  if (ctx.restSeconds != null) prescription.push(`Descanso: ${ctx.restSeconds}s`);
  if (ctx.rpeTarget != null) prescription.push(`RPE ${ctx.rpeTarget}`);
  if (prescription.length) lines.push(`📋 ${prescription.join(' · ')}`);

  if (ctx.cues) lines.push(`💡 ${ctx.cues}`);

  lines.push('');
  lines.push('Responde *siguiente* cuando termines.');
  return lines.join('\n');
}

export function renderDailyGreeting(ctx: {
  name: string;
  focus: string | null;
  durationMin: number | null;
  exerciseCount: number;
}): string {
  const [firstName, focus, meta] = buildDailyGreetingParams(ctx);
  // Copia literal del cuerpo aprobado por Meta, sangria incluida: los dos
  // espacios se colaron al registrar la plantilla y quedaron congelados ahi.
  // Se replican para que el cliente vea lo mismo por cualquiera de los dos
  // canales; se limpian cuando haya que revisar la plantilla por otro motivo.
  return [
    `Hola ${firstName}, tu sesión de entrenamiento de hoy ya está disponible en tu plan.`,
    '',
    `  Enfoque del día: ${focus}`,
    `  Duración estimada: ${meta}`,
    '',
    '  Responde *iniciar* para comenzar.',
  ].join('\n');
}

/**
 * Variables del saludo diario para la plantilla `greeting` de la Cloud API,
 * en el orden de los placeholders:
 *
 *   Hola {{1}}, tu sesión de entrenamiento de hoy ya está disponible en tu plan.
 *     Enfoque del día: {{2}}
 *     Duración estimada: {{3}}
 *
 * `renderDailyGreeting` arma su texto con estas mismas variables, asi que los
 * dos canales muestran exactamente lo mismo y no pueden desincronizarse.
 *
 * El cuerpo fijo esta congelado por la aprobacion de Meta (2026-08-11):
 * cambiarlo exige otra revision de 24-48h.
 *
 * Meta rechaza el envio si alguna variable llega vacia, con saltos de linea o
 * con espacios de sobra — de ahi los fallbacks y el saneo.
 */
export function buildDailyGreetingParams(ctx: {
  name: string;
  focus: string | null;
  durationMin: number | null;
  exerciseCount: number;
}): [string, string, string] {
  const meta: string[] = [];
  if (ctx.durationMin) meta.push(`~${ctx.durationMin} min`);
  if (ctx.exerciseCount > 0) meta.push(`${ctx.exerciseCount} ejercicios`);

  return [
    sanitizeParam(ctx.name.split(' ')[0], 'Hola'),
    sanitizeParam(ctx.focus, 'tu rutina del dia'),
    sanitizeParam(meta.join(' · '), 'a tu ritmo'),
  ];
}

/** Una variable de plantilla es una sola linea, sin espacios repetidos ni vacia. */
function sanitizeParam(value: string | null | undefined, fallback: string): string {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > 0 ? clean : fallback;
}

export function renderFinishMessage(ctx: { name: string; completionRate: number }): string {
  const firstName = ctx.name.split(' ')[0];
  if (ctx.completionRate >= 1) {
    return `✅ Bien hecho, ${firstName}. Completaste todo. Nos vemos mañana. 🙌`;
  }
  if (ctx.completionRate >= 0.5) {
    return `Buen trabajo, ${firstName}. Cerramos por hoy. Descansa, mañana seguimos.`;
  }
  return `Dia cerrado, ${firstName}. Descansa, mañana arrancamos de nuevo.`;
}

export const TXT_NO_ACTIVE_PLAN =
  'Todavia no tenes un plan activo. Habla con tu entrenador.';
export const TXT_PLAN_FUTURE = (startDate: string) =>
  `Tu plan arranca el ${startDate}. Nos vemos ese dia.`;
export const TXT_PLAN_ENDED =
  'Tu plan termino. Habla con tu entrenador para armar el siguiente.';
export const TXT_STOP_ACK =
  'Listo, no te escribo mas. Si algun dia queres retomar, hablalo con tu entrenador. 🙌';
export const TXT_REST_DAY =
  'Hoy es dia de descanso. Nos vemos mañana. 🌿';
export const TXT_UNKNOWN_IN_SESSION =
  'No te entendi. Responde *siguiente*, *saltar* o *cambiar*.';
export const TXT_UNKNOWN_GREETED = 'Responde *iniciar* cuando estés listo/a.';
export const TXT_UNKNOWN_OFFHOURS = 'Descansa, mañana seguimos.';
export const TXT_PAIN_ACK =
  'Recibido. Ya aviso a tu entrenador y saltamos ese ejercicio. Seguimos con el siguiente.';
export const TXT_CHANGE_ACK =
  'Ok, aviso a tu entrenador para que te proponga alternativa. Mientras tanto responde *siguiente* para continuar.';
