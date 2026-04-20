import { z } from 'zod';

export const intent = z.enum([
  'START',
  'NEXT',
  'SKIP',
  'CHANGE',
  'PAIN',
  'FINISH',
  'UNKNOWN',
]);

export type Intent = z.infer<typeof intent>;

export const intentClassification = z.object({
  intent,
  confidence: z.number().min(0).max(1),
  matchedKeyword: z.string().optional(),
});

export type IntentClassification = z.infer<typeof intentClassification>;
