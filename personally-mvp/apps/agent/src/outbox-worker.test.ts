import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessagingChannel } from '@personally/messaging';
import type { ApiClient, OutboxMessage } from './api-client.js';
import type { AgentCommand } from './sse-client.js';

const subscribeToEvents = vi.fn();

vi.mock('./sse-client.js', () => ({
  subscribeToEvents: (opts: unknown) => subscribeToEvents(opts),
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock('./logger.js', () => ({ logger }));

const { startOutboxWorker } = await import('./outbox-worker.js');

const TRAINER_ID = '11111111-1111-1111-1111-111111111111';

function makeMessage(id: string): OutboxMessage {
  return {
    id,
    clientId: 'c1',
    phone: '573001112233',
    sessionId: null,
    exerciseLogId: null,
    contentType: 'text',
    text: 'hola',
    isTemplateBased: false,
  };
}

/** Canal minimo: solo lo que el worker toca. */
function makeChannel(state: 'online' | 'offline' = 'online') {
  const send = vi.fn(async () => ({ externalId: 'wamid.1', sentAt: new Date() }));
  const channel = {
    getSessionState: () => state,
    onSessionStateChange: vi.fn(),
    send,
  } as unknown as MessagingChannel;
  return { channel, send };
}

/** API fake que entrega la cola una vez y despues devuelve null. */
function makeApi(queue: OutboxMessage[]) {
  let resolveDrained: () => void = () => {};
  const drained = new Promise<void>((r) => {
    resolveDrained = r;
  });
  const pending = [...queue];
  const takeNextOutbox = vi.fn(async () => {
    const next = pending.shift() ?? null;
    if (!next) resolveDrained();
    return next;
  });
  const postOutgoing = vi.fn(async () => ({ messageId: 'm1' }));
  return { api: { takeNextOutbox, postOutgoing } as unknown as ApiClient, drained, postOutgoing };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Neutraliza el setInterval del polling: el test no debe depender del reloj.
  vi.useFakeTimers();
  vi.stubEnv('AGENT_TRAINER_ID', TRAINER_ID);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('startOutboxWorker', () => {
  it('drena lo encolado apenas arranca, sin esperar al polling ni a un evento SSE', async () => {
    const { channel, send } = makeChannel();
    const { api, drained, postOutgoing } = makeApi([makeMessage('o1')]);

    startOutboxWorker({ channel, api });
    await drained;

    expect(send).toHaveBeenCalledWith('573001112233', expect.objectContaining({ text: 'hola' }));
    expect(postOutgoing).toHaveBeenCalledWith(
      '573001112233',
      expect.objectContaining({ externalId: 'wamid.1' }),
    );
  });

  it('no drena si el canal no esta online', async () => {
    const { channel, send } = makeChannel('offline');
    const { api } = makeApi([makeMessage('o1')]);

    startOutboxWorker({ channel, api });
    await Promise.resolve();

    expect(send).not.toHaveBeenCalled();
  });

  it('sin AGENT_TRAINER_ID no se suscribe a nada (evita drenar la cola de otro)', () => {
    vi.stubEnv('AGENT_TRAINER_ID', '');
    const { channel } = makeChannel();
    const { api } = makeApi([]);

    startOutboxWorker({ channel, api });

    expect(subscribeToEvents).not.toHaveBeenCalled();
  });

  it('el comando reinit solo loguea: la Cloud API no tiene sesion que reiniciar', async () => {
    const { channel, send } = makeChannel();
    const { api, drained } = makeApi([]);

    startOutboxWorker({ channel, api });
    await drained;

    const opts = subscribeToEvents.mock.calls[0]![0] as {
      onCommand: (cmd: AgentCommand) => void;
    };
    expect(() => opts.onCommand({ type: 'reinit' })).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('reinit'));
    expect(send).not.toHaveBeenCalled();
  });

  it('un envio fallido reporta el error al API y no corta el drenado', async () => {
    const { channel, send } = makeChannel();
    (send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('meta 400'));
    const { api, drained, postOutgoing } = makeApi([makeMessage('o1'), makeMessage('o2')]);

    startOutboxWorker({ channel, api });
    await drained;

    expect(postOutgoing).toHaveBeenCalledWith(
      '573001112233',
      expect.objectContaining({ externalId: 'failed-o1', error: 'meta 400' }),
    );
    expect(send).toHaveBeenCalledTimes(2);
  });
});
