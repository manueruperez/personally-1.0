import { z } from 'zod';
import { uuid } from './common.js';

export const direction = z.enum(['inbound', 'outbound']);

export const contentType = z.enum([
  'text',
  'image',
  'audio',
  'video',
  'sticker',
  'document',
  'unknown',
]);

export const messageSchema = z.object({
  id: uuid,
  clientId: uuid,
  sessionId: uuid.nullable(),
  direction,
  channel: z.string(),
  externalId: z.string(),
  sentAt: z.coerce.date(),
  receivedAt: z.coerce.date().nullable(),
  contentType,
  contentText: z.string().nullable(),
  mediaUrl: z.string().url().nullable(),
  intentDetected: z.string().nullable(),
  intentConfidence: z.number().min(0).max(1).nullable(),
  triggeredAction: z.string().nullable(),
  exerciseLogId: uuid.nullable(),
  templateKey: z.string().nullable(),
  isTemplateBased: z.boolean().nullable(),
  agentVersion: z.string().nullable(),
  error: z.string().nullable(),
});

export const incomingMessageInput = z.object({
  externalId: z.string().min(1),
  receivedAt: z.coerce.date(),
  contentType,
  contentText: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});

export const outgoingMessageInput = z.object({
  externalId: z.string().min(1),
  sentAt: z.coerce.date(),
  contentType,
  contentText: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  templateKey: z.string().optional(),
  isTemplateBased: z.boolean().optional(),
  agentVersion: z.string().optional(),
  error: z.string().optional(),
  sessionId: uuid.optional(),
  exerciseLogId: uuid.optional(),
});

export type Direction = z.infer<typeof direction>;
export type ContentType = z.infer<typeof contentType>;
export type Message = z.infer<typeof messageSchema>;
export type IncomingMessageInput = z.infer<typeof incomingMessageInput>;
export type OutgoingMessageInput = z.infer<typeof outgoingMessageInput>;
