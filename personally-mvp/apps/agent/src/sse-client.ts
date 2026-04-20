import { logger } from './logger.js';

export type AgentCommand = { type: 'reinit' } | { type: 'ping' };

interface SubscribeOptions {
  url: string;
  token: string;
  onOutbox: () => void;
  onCommand?: (cmd: AgentCommand) => void;
  signal?: AbortSignal;
}

/**
 * Cliente SSE basado en fetch streaming. Soporta custom headers.
 *
 * Eventos:
 *  - `event: outbox`  → onOutbox()
 *  - `event: command` → onCommand(data)
 * Reconecta con backoff exponencial (max 30s).
 */
export async function subscribeToEvents(opts: SubscribeOptions): Promise<void> {
  let attempt = 0;

  while (!opts.signal?.aborted) {
    try {
      const res = await fetch(opts.url, {
        headers: {
          'x-agent-token': opts.token,
          Accept: 'text/event-stream',
        },
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE connect returned ${res.status}`);
      }

      attempt = 0;
      logger.info('SSE conectado');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            handleEvent(block, opts);
          }
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      }

      logger.warn('SSE cerrado por el servidor, reconectando');
    } catch (err) {
      if (opts.signal?.aborted) return;
      logger.warn({ err: String(err) }, 'SSE error, reconectando');
    }

    attempt = Math.min(attempt + 1, 5);
    const delayMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
    await sleep(delayMs);
  }
}

function handleEvent(block: string, opts: SubscribeOptions): void {
  const lines = block.split('\n').map((l) => l.trimStart());
  if (lines.every((l) => l.startsWith(':') || l === '')) return;

  const eventLine = lines.find((l) => l.startsWith('event:'));
  const dataLine = lines.find((l) => l.startsWith('data:'));
  const eventName = eventLine?.slice('event:'.length).trim() ?? 'message';

  if (eventName === 'outbox') {
    opts.onOutbox();
    return;
  }
  if (eventName === 'command' && dataLine && opts.onCommand) {
    try {
      const cmd = JSON.parse(dataLine.slice('data:'.length).trim()) as AgentCommand;
      opts.onCommand(cmd);
    } catch (err) {
      logger.warn({ err: String(err) }, 'command mal formado');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
