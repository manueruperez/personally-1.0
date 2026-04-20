import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card';
import { useClientMessages } from '@/features/messages/hooks';
import type { MessageDto } from '@/features/messages/api';
import { cn } from '@/lib/utils';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `ayer ${format(d, 'HH:mm')}`;
  return format(d, 'dd/MM HH:mm');
}

/** Considera "abajo" cuando esta a menos de 100px del fondo. */
function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
}

export function ClientConversation({ clientId }: { clientId: string }) {
  const { data, isLoading, isError } = useClientMessages(clientId, 100);

  const messages = (data ?? []).slice().sort((a, b) =>
    new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const messageCount = messages.length;

  // Al primer render con mensajes → jump al final
  // Luego solo auto-scroll si el usuario estaba pegado al fondo
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || messageCount === 0) return;
    if (stickToBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messageCount, stickToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setStickToBottom(isNearBottom(el));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Conversación</CardTitle>
          <CardDescription>
            Últimos 100 mensajes · se actualiza cada 5s
          </CardDescription>
        </div>
        {data && (
          <span className="text-xs text-muted-foreground">
            {data.length} mensaje{data.length === 1 ? '' : 's'}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-center text-muted-foreground py-6">Cargando...</p>
        )}
        {isError && <p className="text-center text-destructive py-6">Error</p>}
        {data && messages.length === 0 && (
          <p className="text-center text-muted-foreground py-6">
            Todavía no hay mensajes.
          </p>
        )}
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="relative space-y-3 max-h-[500px] overflow-y-auto"
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {!stickToBottom && (
              <button
                type="button"
                onClick={() => {
                  const el = scrollRef.current;
                  if (el) el.scrollTop = el.scrollHeight;
                  setStickToBottom(true);
                }}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full shadow-md"
              >
                ↓ Ir al final
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message: m }: { message: MessageDto }) {
  const isOutbound = m.direction === 'outbound';
  const hasError = !!m.error;

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex flex-col max-w-[80%]', isOutbound ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
            isOutbound
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm',
            hasError && 'border border-destructive',
          )}
        >
          {m.contentText ?? <em className="text-xs">({m.contentType})</em>}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatTime(m.sentAt)}</span>

          {!isOutbound && m.intentDetected && (
            <Badge
              variant={m.intentDetected === 'UNKNOWN' ? 'outline' : 'secondary'}
              className="text-[10px] py-0 px-1.5"
            >
              {m.intentDetected}
            </Badge>
          )}

          {isOutbound && m.templateKey && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {m.templateKey}
            </Badge>
          )}

          {hasError && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              error
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
