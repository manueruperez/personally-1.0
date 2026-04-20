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
  UNKNOWN: [],
};

// Ordenar intents por prioridad: PAIN va primero (override cualquier otro),
// luego START (solo en Greeted), luego FINISH, CHANGE, SKIP, NEXT.
// El orden dentro de classify() respeta esto.
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
}

function matchesKeyword(text: string, keyword: string): boolean {
  // Match por palabra completa o sub-frase
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  const words = text.split(' ');
  return words.some((w) => w === keyword || w.startsWith(keyword));
}
