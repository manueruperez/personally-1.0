import type { IntentClassification } from '@personally/types';

/**
 * Interfaz del clasificador de intenciones.
 * V1: implementacion por keywords (KeywordIntentClassifier).
 * V2 (post-MVP): adapter a un LLM externo.
 */
export interface IntentClassifier {
  classify(text: string, context?: ClassifierContext): Promise<IntentClassification>;
}

export interface ClassifierContext {
  /** Estado actual de la sesion de entrenamiento (puede afectar interpretacion). */
  sessionState?: 'idle' | 'greeted' | 'in_warmup' | 'in_exercise' | 'in_cooldown' | 'paused';
}
