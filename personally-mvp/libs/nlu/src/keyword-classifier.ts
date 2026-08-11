import type { Intent, IntentClassification } from '@personally/types';
import type { ClassifierContext, IntentClassifier } from './classifier.js';
import { normalize } from './normalize.js';

type KeywordMap = Record<Intent, string[]>;

const DEFAULT_KEYWORDS: KeywordMap = {
  START: ['iniciar', 'empezar', 'vamos', 'arranquemos', 'comenzar'],
  NEXT: ['siguiente', 'listo', 'next', 'hecho', 'termine', 'ya', 'ok', 'dale'],
  SKIP: ['saltar', 'pasar', 'skip', 'no puedo', 'saltemos', 'salta'],
  CHANGE: ['cambiar', 'otro', 'alternativa', 'reemplazar', 'no me gusta'],
  FINISH: ['finalizar', 'fin', 'termine', 'acabar', 'cerrar'],
  PAIN: ['dolor', 'me duele', 'lesion', 'lesione', 'lastimar', 'lastime', 'molestia'],
  // Frases largas: son inequivocas, asi que alcanza con que aparezcan.
  STOP: [
    'darme de baja',
    'dar de baja',
    'no quiero recibir',
    'no me escribas',
    'dejar de recibir',
    'cancelar suscripcion',
  ],
  UNKNOWN: [],
};

/**
 * Palabras que dan de baja solo si son el mensaje completo.
 *
 * El matcher normal acepta prefijos, y en un contexto de entrenamiento "baja"
 * aparece todo el tiempo de forma inocente: "baja el peso", "bajale a la carga",
 * "bajo mucho el ritmo". Dar de baja a alguien por eso lo dejaria sin su rutina
 * sin que lo haya pedido, asi que aca se exige coincidencia exacta.
 */
const STOP_EXACT = ['baja', 'stop', 'unsubscribe', 'cancelar', 'salir'];

// Ordenar intents por prioridad: PAIN va primero (override cualquier otro),
// luego START (solo en Greeted), luego FINISH, CHANGE, SKIP, NEXT.
// El orden dentro de classify() respeta esto.
// STOP no esta aca: se evalua aparte y antes que todos (ver classify).
const PRIORITY_ORDER: Intent[] = ['PAIN', 'FINISH', 'CHANGE', 'SKIP', 'START', 'NEXT'];

export interface KeywordClassifierOptions {
  keywords?: Partial<KeywordMap>;
}

export class KeywordIntentClassifier implements IntentClassifier {
  private readonly keywords: KeywordMap;

  constructor(opts: KeywordClassifierOptions = {}) {
    this.keywords = { ...DEFAULT_KEYWORDS, ...opts.keywords } as KeywordMap;
  }

  async classify(text: string, context?: ClassifierContext): Promise<IntentClassification> {
    const normalized = normalize(text);

    // La baja se evalua antes que todo: es una decision sobre el consentimiento
    // del cliente y no deberia perder contra una palabra de la rutina que
    // aparezca en el mismo mensaje.
    const stop = this.matchStop(normalized);
    if (stop) return { intent: 'STOP', confidence: 1.0, matchedKeyword: stop };

    for (const intent of PRIORITY_ORDER) {
      // START solo valido en estado greeted
      if (intent === 'START' && context?.sessionState && context.sessionState !== 'greeted') {
        // Si esta en sesion activa, "listo" ya lo captura NEXT mas abajo
        continue;
      }

      const kws = this.keywords[intent] ?? [];
      for (const kw of kws) {
        if (matchesKeyword(normalized, kw)) {
          return { intent, confidence: 1.0, matchedKeyword: kw };
        }
      }
    }

    return { intent: 'UNKNOWN', confidence: 0 };
  }

  /** Devuelve la keyword que disparo la baja, o null. */
  private matchStop(normalized: string): string | null {
    const bare = normalized.replace(/[.!¡?¿,]/g, '').trim();
    if (STOP_EXACT.includes(bare)) return bare;

    for (const phrase of this.keywords.STOP ?? []) {
      if (normalized.includes(phrase)) return phrase;
    }
    return null;
  }
}

function matchesKeyword(text: string, keyword: string): boolean {
  // Match por palabra completa o sub-frase
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  const words = text.split(' ');
  return words.some((w) => w === keyword || w.startsWith(keyword));
}
