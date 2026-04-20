import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Send, Sunrise } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card';
import { AgentStatusDot, isAgentOnline } from '@/components/atoms/AgentStatusDot';
import {
  useResetTodaySession,
  useSendDailyGreeting,
  useSendTestMessage,
} from '@/features/clients/hooks';
import { useAgentStatus } from '@/features/agent/hooks';

export function QuickSendMessage({
  clientId,
  clientPhone,
}: {
  clientId: string;
  clientPhone: string;
}) {
  const [text, setText] = useState('');
  const [lastSent, setLastSent] = useState<string | null>(null);
  const send = useSendTestMessage(clientId);
  const reset = useResetTodaySession(clientId);
  const greet = useSendDailyGreeting(clientId);
  const { data: agentStatus } = useAgentStatus();
  const online = isAgentOnline(agentStatus?.state);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !online) return;
    const sent = text;
    await send.mutateAsync(sent);
    setLastSent(sent);
    setText('');
    setTimeout(() => {
      send.reset();
      setLastSent(null);
    }, 4000);
  }

  async function onReset() {
    if (
      !window.confirm(
        'Resetear la sesion de HOY? Se borra la sesion y logs para que puedas volver a mandar "iniciar".',
      )
    )
      return;
    await reset.mutateAsync();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            Enviar mensaje
            {agentStatus && <AgentStatusDot state={agentStatus.state} />}
          </CardTitle>
          <CardDescription>
            Se envia por WhatsApp al numero {clientPhone}.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => greet.mutate()}
            disabled={greet.isPending || !online}
            title={online ? 'Envia el saludo matutino' : 'Agente desconectado'}
          >
            <Sunrise className="h-3.5 w-3.5 mr-1" />
            Saludo diario
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={reset.isPending}
            title="Borra la sesion de hoy para volver a probar desde cero"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset sesión
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!online && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1">
              El agente WhatsApp no está disponible
              {agentStatus?.state && <span> ({agentStatus.state})</span>}. No
              puedes enviar mensajes ahora.{' '}
              <Link to="/agent" className="underline font-medium">
                Ver estado
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              online ? 'Escribe un mensaje de prueba...' : 'Agente desconectado'
            }
            rows={2}
            disabled={!online}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={send.isPending || !text.trim() || !online}>
            <Send className="h-4 w-4 mr-1" />
            {send.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </form>

        {send.isError && (
          <p className="text-sm text-destructive mt-2">
            {(send.error as Error)?.message ?? 'No se pudo enviar'}
          </p>
        )}
        {lastSent && send.isSuccess && (
          <p className="text-sm text-primary mt-2">
            ✓ Enviado: "{lastSent.slice(0, 60)}
            {lastSent.length > 60 ? '…' : ''}"
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Tip: Shift+Enter para salto de linea · Enter para enviar
        </p>
      </CardContent>
    </Card>
  );
}
