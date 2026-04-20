import { logger } from './logger.js';

export interface IncomingPayload {
  externalId: string;
  receivedAt: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'sticker' | 'document' | 'unknown';
  contentText?: string;
  mediaUrl?: string;
}

export interface OutgoingPayload {
  externalId: string;
  sentAt: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'sticker' | 'document' | 'unknown';
  contentText?: string;
  mediaUrl?: string;
  templateKey?: string;
  isTemplateBased?: boolean;
  agentVersion?: string;
  error?: string;
  sessionId?: string;
  exerciseLogId?: string;
}

export interface IncomingResponse {
  messageId: string;
  sessionId: string | null;
  intent: string;
  confidence: number;
  triggeredAction: string;
}

export interface HeartbeatPayload {
  trainerId: string;
  state: string;
  uptimeSec: number;
  agentVersion?: string;
  qr?: string | null;
}

export interface OutboxMessage {
  id: string;
  clientId: string;
  phone: string;
  sessionId: string | null;
  exerciseLogId: string | null;
  contentType: 'text' | 'image' | 'video';
  text?: string;
  mediaUrl?: string;
  caption?: string;
  templateKey?: string;
  isTemplateBased: boolean;
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly agentVersion: string,
  ) {}

  async postIncoming(phone: string, payload: IncomingPayload): Promise<IncomingResponse> {
    return this.post<IncomingResponse>(
      `/api/v1/internal/clients/${encodeURIComponent(phone)}/incoming-message`,
      payload,
    );
  }

  async postOutgoing(phone: string, payload: OutgoingPayload): Promise<{ messageId: string }> {
    return this.post<{ messageId: string }>(
      `/api/v1/internal/clients/${encodeURIComponent(phone)}/outgoing-message`,
      { ...payload, agentVersion: payload.agentVersion ?? this.agentVersion },
    );
  }

  async postHeartbeat(payload: HeartbeatPayload): Promise<void> {
    await this.post('/api/v1/internal/agent/heartbeat', {
      ...payload,
      agentVersion: payload.agentVersion ?? this.agentVersion,
    });
  }

  async takeNextOutbox(trainerId: string): Promise<OutboxMessage | null> {
    const url = `${this.baseUrl}/api/v1/internal/outbox/next?trainerId=${encodeURIComponent(trainerId)}`;
    const res = await fetch(url, { headers: { 'x-agent-token': this.token } });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: OutboxMessage | null };
    return json.data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agent-token': this.token,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ path, status: res.status, text }, 'api error');
      throw new Error(`API ${path} returned ${res.status}`);
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  }
}
