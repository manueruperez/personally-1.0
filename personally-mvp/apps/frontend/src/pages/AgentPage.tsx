import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/atoms/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card';
import { useAgentStatus } from '@/features/agent/hooks';
import type { AgentState } from '@/features/agent/api';

const stateVariant: Record<AgentState, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  online: 'success',
  initializing: 'warning',
  offline: 'destructive',
  unknown: 'secondary',
};

const stateLabel: Record<AgentState, string> = {
  online: 'En línea',
  initializing: 'Arrancando',
  offline: 'Caído',
  unknown: 'Sin datos',
};

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function AgentPage() {
  const { data, isLoading } = useAgentStatus();
  // `unknown` es "nunca reporto"; `offline` es "dejo de reportar". Para el
  // trainer son lo mismo: el bot no esta mandando mensajes.
  const down = data?.state === 'offline' || data?.state === 'unknown';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Bot de WhatsApp</h1>
        <p className="text-muted-foreground">
          Mientras esté en línea, tus clientes reciben el saludo y la rutina sin que hagas nada.
        </p>
      </div>

      {isLoading && !data && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Cargando...</CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Estado</CardTitle>
                  <CardDescription>
                    {data.state === 'unknown'
                      ? 'El bot todavía no dio señales de vida.'
                      : `Última señal: hace ${formatDistanceToNow(new Date(data.lastHeartbeatAt), {
                          locale: es,
                        })}`}
                  </CardDescription>
                </div>
                <Badge variant={stateVariant[data.state]}>{stateLabel[data.state]}</Badge>
              </div>
            </CardHeader>
            {data.state === 'online' && (
              <CardContent className="text-sm text-muted-foreground">
                Funcionando hace {formatUptime(data.uptimeSec)}
                {data.agentVersion && ` · versión ${data.agentVersion}`}
              </CardContent>
            )}
          </Card>

          {down && (
            <Card>
              <CardContent className="py-6 text-sm space-y-2">
                <p className="text-destructive font-medium">
                  El bot no está enviando mensajes de WhatsApp.
                </p>
                <p className="text-muted-foreground">
                  Los mensajes que se generen mientras tanto quedan en cola y salen apenas vuelva.
                  Lo que se atrasa es la hora a la que tus clientes los reciben.
                </p>
                <p className="text-muted-foreground">
                  No hay nada que apretar acá: el bot vuelve solo cuando el servidor lo levanta. Si
                  sigue caído en unos minutos, avisale a quien administra Personally.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
