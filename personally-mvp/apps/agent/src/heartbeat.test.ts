import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessagingChannel, SessionState, SessionStateHandler } from '@personally/messaging';
import type { ApiClient, HeartbeatPayload } from './api-client.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock('./logger.js', () => ({ logger }));

const { startHeartbeat } = await import('./heartbeat.js');

const TRAINER_ID = '11111111-1111-1111-1111-111111111111';

/** Canal minimo: solo lo que el heartbeat toca. */
function makeChannel(state: SessionState = 'online') {
  const handlers: SessionStateHandler[] = [];
  const channel = {
    getSessionState: () => state,
    onSessionStateChange: (h: SessionStateHandler) => {
      handlers.push(h);
    },
  } as unknown as MessagingChannel;
  return { channel, handlers };
}

function makeApi() {
  const postHeartbeat = vi.fn(async (_payload: HeartbeatPayload) => {});
  return { api: { postHeartbeat } as unknown as ApiClient, postHeartbeat };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('AGENT_TRAINER_ID', TRAINER_ID);
  logger.warn.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('startHeartbeat', () => {
  it('reporta el estado del canal sin esperar al primer intervalo', () => {
    const { channel } = makeChannel();
    const { api, postHeartbeat } = makeApi();

    startHeartbeat({ channel, api });

    expect(postHeartbeat).toHaveBeenCalledTimes(1);
    expect(postHeartbeat.mock.calls[0]![0]).toEqual({
      trainerId: TRAINER_ID,
      state: 'online',
      uptimeSec: expect.any(Number),
    });
  });

  it('el payload ya no lleva qr: la Cloud API no vincula ningun dispositivo', () => {
    const { channel } = makeChannel();
    const { api, postHeartbeat } = makeApi();

    startHeartbeat({ channel, api });

    expect(postHeartbeat.mock.calls[0]![0]).not.toHaveProperty('qr');
  });

  it('sigue latiendo cada minuto', async () => {
    const { channel } = makeChannel();
    const { api, postHeartbeat } = makeApi();

    startHeartbeat({ channel, api });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(postHeartbeat).toHaveBeenCalledTimes(3);
  });

  it('un cambio de estado adelanta el latido en vez de esperar el minuto', () => {
    const { channel, handlers } = makeChannel();
    const { api, postHeartbeat } = makeApi();

    startHeartbeat({ channel, api });
    handlers[0]!('offline');

    expect(postHeartbeat).toHaveBeenCalledTimes(2);
  });

  it('un API caido no tumba al agente', async () => {
    const { channel } = makeChannel();
    const { api, postHeartbeat } = makeApi();
    postHeartbeat.mockRejectedValue(new Error('ECONNREFUSED'));

    startHeartbeat({ channel, api });
    await vi.advanceTimersByTimeAsync(0);

    expect(logger.warn).toHaveBeenCalledWith(expect.anything(), 'heartbeat failed');
  });

  it('sin AGENT_TRAINER_ID avisa: el API no va a poder atribuir el estado', () => {
    vi.stubEnv('AGENT_TRAINER_ID', '');
    const { channel } = makeChannel();
    const { api } = makeApi();

    startHeartbeat({ channel, api });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('AGENT_TRAINER_ID'));
  });
});
