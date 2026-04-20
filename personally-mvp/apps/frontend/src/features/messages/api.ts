import { api } from '@/lib/api';

export interface MessageDto {
  id: string;
  clientId: string;
  sessionId: string | null;
  direction: 'inbound' | 'outbound';
  channel: string;
  externalId: string;
  sentAt: string;
  receivedAt: string | null;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'sticker' | 'document' | 'unknown';
  contentText: string | null;
  mediaUrl: string | null;
  intentDetected: string | null;
  intentConfidence: string | number | null;
  triggeredAction: string | null;
  templateKey: string | null;
  isTemplateBased: boolean | null;
  agentVersion: string | null;
  error: string | null;
}

export const messagesApi = {
  listByClient: (clientId: string, limit = 50) =>
    api.get<MessageDto[]>(`/api/v1/clients/${clientId}/messages?limit=${limit}`),
};
