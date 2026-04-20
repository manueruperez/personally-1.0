import { QRCodeSVG } from 'qrcode.react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card';
import { useAgentStatus, useReconnectAgent } from '@/features/agent/hooks';
import type { AgentState } from '@/features/agent/api';

const stateVariant: Record<AgentState, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  online: 'success',
  authenticating: 'warning',
  qr_required: 'warning',
  initializing: 'warning',
  reconnecting: 'warning',
  offline: 'destructive',
  unknown: 'secondary',
};

const stateLabel: Record<AgentState, string> = {
  online: 'En linea',
  authenticating: 'Autenticando',
  qr_required: 'QR requerido',
  initializing: 'Inicializando',
  reconnecting: 'Reconectando',
  offline: 'Desconectado',
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
  const reconnect = useReconnectAgent();
  // El "unknown" no es reconectable via SSE (no hay proceso vivo que lo reciba).
  // Para ese caso hay que usar el supervisor (pnpm agent:supervised).
  const canReconnect = data && data.state !== 'unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Agente WhatsApp</h1>
          <p className="text-muted-foreground">Estado de la sesion que envia las rutinas.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => reconnect.mutate()}
          disabled={!canReconnect || reconnect.isPending}
          title={
            canReconnect
              ? 'Fuerza al agente a re-inicializar Puppeteer sin perder la sesion de WhatsApp.'
              : 'Proceso no disponible. Arrancalo con `pnpm agent:supervised` para auto-revivir.'
          }
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${reconnect.isPending ? 'animate-spin' : ''}`}
          />
          {reconnect.isPending ? 'Reconectando...' : 'Reconectar'}
        </Button>
      </div>

      {reconnect.isSuccess && (
        <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          Comando enviado. El estado va a cambiar a "reconectando" en unos segundos.
        </div>
      )}
      {reconnect.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo enviar el comando: {(reconnect.error as Error).message}
        </div>
      )}

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
                      ? 'El agente no se ha reportado aun. Arrancalo con `pnpm agent:dev`.'
                      : `Ultima actualizacion: hace ${formatDistanceToNow(
                          new Date(data.lastHeartbeatAt),
                          { locale: es },
                        )}`}
                  </CardDescription>
                </div>
                <Badge variant={stateVariant[data.state]}>{stateLabel[data.state]}</Badge>
              </div>
            </CardHeader>
            {data.state === 'online' && (
              <CardContent className="text-sm text-muted-foreground">
                Uptime: {formatUptime(data.uptimeSec)}
                {data.agentVersion && ` · v${data.agentVersion}`}
              </CardContent>
            )}
          </Card>

          {data.state === 'qr_required' && data.qr && (
            <Card>
              <CardHeader>
                <CardTitle>Escanea este codigo</CardTitle>
                <CardDescription>
                  WhatsApp del bot → Menu → Dispositivos vinculados → Vincular un dispositivo
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-6">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG value={data.qr} size={256} level="M" />
                </div>
                <p className="text-xs text-muted-foreground">
                  El codigo se regenera automaticamente si expira.
                </p>
              </CardContent>
            </Card>
          )}

          {data.state === 'offline' && (
            <Card>
              <CardContent className="py-6 text-sm">
                <p className="text-destructive font-medium">El agente esta desconectado.</p>
                <p className="text-muted-foreground mt-1">
                  Probá el botón <strong>Reconectar</strong> arriba. Si no funciona, el proceso
                  probablemente murió — reinicialo con{' '}
                  <code>pnpm agent:supervised</code> (auto-reinicia si crashea).
                </p>
              </CardContent>
            </Card>
          )}

          {data.state === 'unknown' && (
            <Card>
              <CardContent className="py-6 text-sm">
                <p className="text-muted-foreground font-medium">
                  Proceso del agente no detectado.
                </p>
                <p className="text-muted-foreground mt-1">
                  Recomendado: <code>pnpm agent:supervised</code> — el supervisor detecta
                  crashes y vuelve a levantar el agente automáticamente. Simple{' '}
                  <code>pnpm agent:dev</code> también sirve pero no se auto-reinicia.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
