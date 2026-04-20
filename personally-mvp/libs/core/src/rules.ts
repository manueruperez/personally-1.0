/**
 * Reglas de negocio puras (sin IO).
 */

/**
 * Dias minimos que debe durar un plan (3 meses).
 */
export const MIN_PLAN_DURATION_DAYS = 90;

/**
 * Ventana horaria en la que el bot puede enviar mensajes (local del cliente).
 */
export const ACTIVE_HOURS = { startHour: 5, endHour: 21 } as const;

/**
 * Umbral default de dias sin respuesta para notificar al trainer.
 * Ver docs/01-producto.md §2.4.
 */
export const DEFAULT_NO_RESPONSE_DAYS_THRESHOLD = 3;

/**
 * Maximo de mensajes por dia por numero de WhatsApp (mitigacion de baneo).
 * Ver specs/bots/01-agente-whatsapp.md §6.
 */
export const MAX_MESSAGES_PER_DAY_PER_NUMBER = 200;

export function isWithinActiveHours(date: Date, timezone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: 'numeric',
  });
  const hour = Number(formatter.format(date));
  return hour >= ACTIVE_HOURS.startHour && hour < ACTIVE_HOURS.endHour;
}

export function calculateCompletionRate(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 1000) / 1000;
}
