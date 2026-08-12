import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_STATES,
  getAgentStatus,
  normalizeAgentState,
  updateAgentStatus,
} from './store.js';

const TRAINER = '11111111-1111-1111-1111-111111111111';

function heartbeat(state: Parameters<typeof normalizeAgentState>[0] = 'online') {
  return updateAgentStatus({
    trainerId: TRAINER,
    state: normalizeAgentState(state),
    uptimeSec: 42,
    agentVersion: '1.0.0',
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeAgentState', () => {
  it('deja pasar los estados vivos', () => {
    expect(normalizeAgentState('online')).toBe('online');
    expect(normalizeAgentState('offline')).toBe('offline');
    expect(normalizeAgentState('initializing')).toBe('initializing');
  });

  it.each(['qr_required', 'authenticating', 'reconnecting'] as const)(
    'traduce %s a offline: un agente de la era wwebjs no rompe el heartbeat',
    (legacy) => {
      expect(normalizeAgentState(legacy)).toBe('offline');
    },
  );

  it('el schema del heartbeat sigue aceptando los estados viejos', () => {
    for (const legacy of ['qr_required', 'authenticating', 'reconnecting']) {
      expect(HEARTBEAT_STATES).toContain(legacy);
    }
  });
});

describe('getAgentStatus', () => {
  it('sin heartbeat previo el estado es unknown, no offline', () => {
    expect(getAgentStatus('22222222-2222-2222-2222-222222222222')).toMatchObject({
      state: 'unknown',
      uptimeSec: 0,
      agentVersion: null,
    });
  });

  it('devuelve el ultimo heartbeat mientras sea reciente', () => {
    heartbeat('online');
    vi.advanceTimersByTime(60_000);

    expect(getAgentStatus(TRAINER)).toMatchObject({ state: 'online', agentVersion: '1.0.0' });
  });

  it('sin latido por mas de 2 min el agente pasa a offline', () => {
    heartbeat('online');
    vi.advanceTimersByTime(3 * 60_000);

    expect(getAgentStatus(TRAINER).state).toBe('offline');
  });

  it('un estado no-online tambien caduca en vez de quedar congelado', () => {
    heartbeat('initializing');
    vi.advanceTimersByTime(3 * 60_000);

    expect(getAgentStatus(TRAINER).state).toBe('offline');
  });

  it('el status no expone qr: ya no hay dispositivo que vincular', () => {
    heartbeat('online');

    expect(getAgentStatus(TRAINER)).not.toHaveProperty('qr');
  });
});
