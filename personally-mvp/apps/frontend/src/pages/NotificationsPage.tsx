import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkNotificationRead,
  useReplyNotification,
} from '@/features/notifications/hooks';
import { useAgentStatus } from '@/features/agent/hooks';
import { isAgentOnline } from '@/components/atoms/AgentStatusDot';
import type { NotificationDto, NotificationType } from '@/features/notifications/api';

const FILTERS = [
  { value: 'unread', label: 'Sin leer' },
  { value: 'all', label: 'Todas' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

const TYPE_META: Record<
  NotificationType,
  { label: string; variant: 'destructive' | 'warning' | 'secondary' }
> = {
  pain_report: { label: 'Dolor', variant: 'destructive' },
  change_request: { label: 'Cambio', variant: 'warning' },
  silent_client: { label: 'Inactivo', variant: 'secondary' },
  agent_offline: { label: 'Agente', variant: 'secondary' },
};

export function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('unread');
  const { data, isLoading, isError, error } = useNotifications(filter === 'unread');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Notificaciones</h1>
        <p className="text-muted-foreground">
          Cambios solicitados, dolor reportado, agente offline.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
              filter === f.value
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Cargando...</CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Error: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filter === 'unread' ? 'No hay notificaciones sin leer.' : 'No hay notificaciones.'}
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification }: { notification: NotificationDto }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const markRead = useMarkNotificationRead();
  const reply = useReplyNotification();
  const { data: agentStatus } = useAgentStatus();
  const online = isAgentOnline(agentStatus?.state);

  const meta = TYPE_META[notification.type] ?? TYPE_META.silent_client;
  const isUnread = !notification.readAt;
  const clientId = notification.metadata?.clientId;
  const canReply = !!clientId;

  async function submitReply() {
    const text = replyText.trim();
    if (!text || !online) return;
    await reply.mutateAsync({ id: notification.id, text });
    setReplyText('');
    setReplyOpen(false);
  }

  return (
    <Card className={cn(isUnread && 'border-l-4 border-l-primary')}>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              <span className="text-sm font-medium truncate">{notification.title}</span>
            </div>
            <p className="text-sm text-muted-foreground break-words">{notification.body}</p>
            {notification.metadata?.exerciseName && (
              <p className="text-xs text-muted-foreground">
                Ejercicio: <span className="font-medium">{notification.metadata.exerciseName}</span>
              </p>
            )}
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatRelative(notification.createdAt)}
          </time>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {clientId && (
            <Link
              to={`/clients/${clientId}`}
              className="text-sm text-primary hover:underline"
            >
              Ver cliente →
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canReply && !replyOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplyOpen(true)}
                disabled={!online}
                title={online ? 'Responder al cliente' : 'Agente desconectado'}
              >
                Responder
              </Button>
            )}
            {isUnread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markRead.mutate(notification.id)}
                disabled={markRead.isPending}
              >
                Descartar
              </Button>
            )}
          </div>
        </div>

        {replyOpen && canReply && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Mensaje para el cliente (se envía por WhatsApp)...`}
              rows={3}
              disabled={!online || reply.isPending}
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitReply();
                }
                if (e.key === 'Escape') {
                  setReplyOpen(false);
                  setReplyText('');
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ⌘+Enter para enviar · Esc para cancelar
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyText('');
                  }}
                  disabled={reply.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => void submitReply()}
                  disabled={!replyText.trim() || !online || reply.isPending}
                >
                  {reply.isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
            {reply.isError && (
              <p className="text-xs text-destructive">
                {(reply.error as Error)?.message ?? 'No se pudo enviar'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'hace segundos';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}
