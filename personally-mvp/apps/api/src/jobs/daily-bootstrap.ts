import { prisma } from '@personally/db';
import { sendDailyGreeting } from '../modules/internal/dispatcher.js';
import { logger } from '../lib/logger.js';

/**
 * Encuentra clientes cuya hora preferida cae en la ultima ventana de X minutos
 * (en su timezone local) y les envia el saludo matutino con preview del dia.
 *
 * Idempotente: crea la sesion del dia si no existe y marca `greeted_at`.
 * Si ya hay sesion creada, no hace nada.
 *
 * Soporta TESTING_DOW override: si esta activo, `sendDailyGreeting` usa el dow forzado.
 */
export async function runDailyBootstrap(options: { windowMinutes?: number } = {}): Promise<{
  evaluated: number;
  greeted: number;
  skipped: number;
}> {
  const windowMinutes = options.windowMinutes ?? 6;

  const clients = await prisma.client.findMany({
    where: {
      status: 'active',
      plans: { some: { status: 'active' } },
    },
    include: { preferences: true },
  });

  const now = new Date();
  let greeted = 0;
  let skipped = 0;

  for (const client of clients) {
    const tz = client.preferences?.timezone ?? 'America/Bogota';
    const preferred = client.preferences?.preferredStartTime ?? '05:00';

    if (!isWithinWindow(now, tz, preferred, windowMinutes)) {
      skipped++;
      continue;
    }

    // No duplicar: si ya existe sesion hoy, saltamos
    const today = startOfLocalDayInTz(now, tz);
    const existing = await prisma.session.findFirst({
      where: { clientId: client.id, scheduledDate: today },
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await sendDailyGreeting({ trainerId: client.trainerId, clientId: client.id });
      greeted++;
      logger.info({ clientId: client.id }, 'daily greeting enqueued');
    } catch (err) {
      logger.error({ err, clientId: client.id }, 'daily greeting failed');
    }
  }

  return { evaluated: clients.length, greeted, skipped };
}

/** Saludo forzado para un cliente puntual (testing / boton manual). */
export async function forceDailyGreeting(clientId: string, trainerId: string): Promise<void> {
  await sendDailyGreeting({ trainerId, clientId });
}

function isWithinWindow(
  now: Date,
  timezone: string,
  preferredHhmm: string,
  windowMinutes: number,
): boolean {
  const [targetH, targetM] = preferredHhmm.split(':').map(Number);
  if (Number.isNaN(targetH) || Number.isNaN(targetM)) return false;

  // Hora local actual en la tz del cliente
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;

  const currentMinutes = h * 60 + m;
  const targetMinutes = targetH! * 60 + targetM!;
  const diff = currentMinutes - targetMinutes;
  // Ventana: target <= current < target + windowMinutes
  return diff >= 0 && diff < windowMinutes;
}

function startOfLocalDayInTz(date: Date, _timezone: string): Date {
  // Aproximacion: servidor corre en la misma zona o usamos UTC midnight del dia local.
  // Para MVP usamos la misma logica del dispatcher (UTC midnight local del servidor).
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
