import { describe, expect, it } from 'vitest';
import { SessionStateMachine, type SessionContext } from './state-machine.js';

const sm = new SessionStateMachine();
const ctx = (state: SessionContext['state'], extra: Partial<SessionContext> = {}): SessionContext => ({
  state,
  ...extra,
});

describe('SessionStateMachine', () => {
  describe('idle', () => {
    it('GREET → greeted + send_greeting', () => {
      const t = sm.transition(ctx('idle'), { type: 'GREET' });
      expect(t.next).toBe('greeted');
      expect(t.actions).toEqual([{ type: 'send_greeting' }]);
    });

    it('intent sin efecto deja estado', () => {
      const t = sm.transition(ctx('idle'), { type: 'INTENT', intent: 'NEXT' });
      expect(t.next).toBe('idle');
      expect(t.actions).toEqual([]);
    });
  });

  describe('greeted', () => {
    it('START → in_warmup + present_next_item', () => {
      const t = sm.transition(ctx('greeted'), { type: 'INTENT', intent: 'START' });
      expect(t.next).toBe('in_warmup');
      expect(t.actions).toEqual([{ type: 'present_next_item' }]);
    });

    it('NEXT también arranca', () => {
      const t = sm.transition(ctx('greeted'), { type: 'INTENT', intent: 'NEXT' });
      expect(t.next).toBe('in_warmup');
    });
  });

  describe('en bloques activos', () => {
    it('NEXT marca done y presenta siguiente', () => {
      const t = sm.transition(ctx('in_exercise'), { type: 'INTENT', intent: 'NEXT' });
      expect(t.next).toBe('in_exercise');
      expect(t.actions).toEqual([{ type: 'mark_item_done' }, { type: 'present_next_item' }]);
    });

    it('SKIP marca skipped y presenta siguiente', () => {
      const t = sm.transition(ctx('in_warmup'), { type: 'INTENT', intent: 'SKIP' });
      expect(t.next).toBe('in_warmup');
      expect(t.actions).toEqual([{ type: 'mark_item_skipped' }, { type: 'present_next_item' }]);
    });

    it('CHANGE pausa y notifica', () => {
      const t = sm.transition(ctx('in_exercise'), { type: 'INTENT', intent: 'CHANGE' });
      expect(t.next).toBe('paused');
      expect(t.actions).toEqual([{ type: 'notify_change_request' }]);
    });

    it('FINISH finaliza desde cualquier bloque', () => {
      const t = sm.transition(ctx('in_cooldown'), { type: 'INTENT', intent: 'FINISH' });
      expect(t.next).toBe('finished');
      expect(t.actions).toEqual([{ type: 'finalize_session' }]);
    });

    it('PAIN pausa y notifica desde cualquier bloque', () => {
      const t = sm.transition(ctx('in_warmup'), { type: 'INTENT', intent: 'PAIN' });
      expect(t.next).toBe('paused');
      expect(t.actions).toEqual([{ type: 'notify_pain' }]);
    });
  });

  describe('BLOCK_COMPLETED', () => {
    it('warmup → in_exercise', () => {
      const t = sm.transition(ctx('in_warmup'), {
        type: 'BLOCK_COMPLETED',
        block: 'warmup',
      });
      expect(t.next).toBe('in_exercise');
    });

    it('exercise → in_cooldown', () => {
      const t = sm.transition(ctx('in_exercise'), {
        type: 'BLOCK_COMPLETED',
        block: 'exercise',
      });
      expect(t.next).toBe('in_cooldown');
    });

    it('cooldown → finished', () => {
      const t = sm.transition(ctx('in_cooldown'), {
        type: 'BLOCK_COMPLETED',
        block: 'cooldown',
      });
      expect(t.next).toBe('finished');
      expect(t.actions).toContainEqual({ type: 'finalize_session' });
    });
  });

  describe('paused', () => {
    it('RESUME vuelve al estado previo', () => {
      const t = sm.transition(
        ctx('paused', { previousState: 'in_exercise' }),
        { type: 'RESUME' },
      );
      expect(t.next).toBe('in_exercise');
      expect(t.actions).toEqual([{ type: 'present_next_item' }]);
    });

    it('sin previousState no hace nada', () => {
      const t = sm.transition(ctx('paused'), { type: 'RESUME' });
      expect(t.next).toBe('paused');
    });
  });

  describe('TIMEOUT_DAY', () => {
    it('desde idle/greeted → missed', () => {
      expect(sm.transition(ctx('idle'), { type: 'TIMEOUT_DAY' }).next).toBe('missed');
      expect(sm.transition(ctx('greeted'), { type: 'TIMEOUT_DAY' }).next).toBe('missed');
    });

    it('en medio de sesion → abandoned', () => {
      expect(sm.transition(ctx('in_warmup'), { type: 'TIMEOUT_DAY' }).next).toBe('abandoned');
      expect(sm.transition(ctx('in_exercise'), { type: 'TIMEOUT_DAY' }).next).toBe('abandoned');
      expect(sm.transition(ctx('in_cooldown'), { type: 'TIMEOUT_DAY' }).next).toBe('abandoned');
    });
  });

  describe('estados terminales', () => {
    for (const state of ['finished', 'missed', 'abandoned'] as const) {
      it(`${state} no transiciona`, () => {
        const t = sm.transition(ctx(state), { type: 'INTENT', intent: 'NEXT' });
        expect(t.next).toBe(state);
        expect(t.actions).toEqual([]);
      });
    }
  });

  describe('PAIN tiene prioridad global', () => {
    for (const state of ['idle', 'greeted', 'in_warmup', 'in_exercise', 'in_cooldown'] as const) {
      it(`PAIN desde ${state} pausa y notifica`, () => {
        const t = sm.transition(ctx(state), { type: 'INTENT', intent: 'PAIN' });
        expect(t.next).toBe('paused');
        expect(t.actions).toContainEqual({ type: 'notify_pain' });
      });
    }
  });
});
