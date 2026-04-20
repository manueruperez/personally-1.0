import type { Intent } from '@personally/types';

/**
 * Maquina de estados de la sesion de entrenamiento.
 * Ver specs/bots/01-agente-whatsapp.md §3.
 *
 * NO ejecuta side-effects: solo calcula (estado_actual, evento) -> estado_siguiente + acciones.
 * Los side-effects (persistir, enviar mensaje) los ejecuta el consumidor (agent / api).
 */

export type EngineState =
  | 'idle'
  | 'greeted'
  | 'in_warmup'
  | 'in_exercise'
  | 'in_cooldown'
  | 'paused'
  | 'finished'
  | 'missed'
  | 'abandoned';

export type EngineEvent =
  | { type: 'GREET' }
  | { type: 'INTENT'; intent: Intent }
  | { type: 'BLOCK_COMPLETED'; block: 'warmup' | 'exercise' | 'cooldown' }
  | { type: 'TIMEOUT_DAY' } // dispara al final del dia sin respuesta
  | { type: 'RESUME' };

export type EngineAction =
  | { type: 'send_greeting' }
  | { type: 'present_next_item' }
  | { type: 'mark_item_done' }
  | { type: 'mark_item_skipped' }
  | { type: 'notify_change_request' }
  | { type: 'notify_pain' }
  | { type: 'finalize_session' }
  | { type: 'mark_session_missed' };

export interface EngineTransition {
  next: EngineState;
  actions: EngineAction[];
}

export interface SessionContext {
  /** Estado actual */
  state: EngineState;
  /** Bloque actual en ejecucion */
  currentBlock?: 'warmup' | 'exercise' | 'cooldown';
  /** Estado anterior (para volver desde `paused`). */
  previousState?: EngineState;
}

export class SessionStateMachine {
  transition(ctx: SessionContext, event: EngineEvent): EngineTransition {
    const { state } = ctx;

    // PAIN corta todo y pausa con notificacion al trainer
    if (event.type === 'INTENT' && event.intent === 'PAIN') {
      return {
        next: 'paused',
        actions: [{ type: 'notify_pain' }],
      };
    }

    // TIMEOUT_DAY desde cualquier estado no terminal
    if (event.type === 'TIMEOUT_DAY') {
      if (state === 'idle' || state === 'greeted') {
        return { next: 'missed', actions: [{ type: 'mark_session_missed' }] };
      }
      if (state === 'in_warmup' || state === 'in_exercise' || state === 'in_cooldown') {
        return { next: 'abandoned', actions: [{ type: 'mark_session_missed' }] };
      }
      return { next: state, actions: [] };
    }

    switch (state) {
      case 'idle': {
        if (event.type === 'GREET') {
          return { next: 'greeted', actions: [{ type: 'send_greeting' }] };
        }
        break;
      }

      case 'greeted': {
        if (event.type === 'INTENT' && (event.intent === 'START' || event.intent === 'NEXT')) {
          return { next: 'in_warmup', actions: [{ type: 'present_next_item' }] };
        }
        break;
      }

      case 'in_warmup':
      case 'in_exercise':
      case 'in_cooldown': {
        if (event.type === 'INTENT') {
          switch (event.intent) {
            case 'NEXT':
              return {
                next: state,
                actions: [{ type: 'mark_item_done' }, { type: 'present_next_item' }],
              };
            case 'SKIP':
              return {
                next: state,
                actions: [{ type: 'mark_item_skipped' }, { type: 'present_next_item' }],
              };
            case 'CHANGE':
              return {
                next: 'paused',
                actions: [{ type: 'notify_change_request' }],
              };
            case 'FINISH':
              return { next: 'finished', actions: [{ type: 'finalize_session' }] };
            default:
              break;
          }
        }

        if (event.type === 'BLOCK_COMPLETED') {
          const nextState = advanceBlock(state, event.block);
          if (nextState === 'finished') {
            return { next: 'finished', actions: [{ type: 'finalize_session' }] };
          }
          return { next: nextState, actions: [{ type: 'present_next_item' }] };
        }
        break;
      }

      case 'paused': {
        if (event.type === 'RESUME' && ctx.previousState) {
          return { next: ctx.previousState, actions: [{ type: 'present_next_item' }] };
        }
        break;
      }

      case 'finished':
      case 'missed':
      case 'abandoned':
        // Estados terminales: no hay transiciones
        return { next: state, actions: [] };
    }

    // No hay transicion valida: mantener estado
    return { next: state, actions: [] };
  }
}

function advanceBlock(
  state: EngineState,
  completedBlock: 'warmup' | 'exercise' | 'cooldown',
): EngineState {
  if (state === 'in_warmup' && completedBlock === 'warmup') return 'in_exercise';
  if (state === 'in_exercise' && completedBlock === 'exercise') return 'in_cooldown';
  if (state === 'in_cooldown' && completedBlock === 'cooldown') return 'finished';
  return state;
}
