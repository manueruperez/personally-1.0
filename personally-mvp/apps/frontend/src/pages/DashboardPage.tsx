import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/lib/utils';
import { useDashboardToday } from '@/features/dashboard/hooks';
import type { DashboardClient } from '@/features/dashboard/api';
import type { SessionStatus } from '@/features/clients/api';

const STATUS_META: Record<
  SessionStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  scheduled: { label: 'Programada', variant: 'secondary' },
  greeted: { label: 'Esperando', variant: 'warning' },
  in_progress: { label: 'En curso', variant: 'default' },
  completed: { label: 'Completada', variant: 'success' },
  partial: { label: 'Parcial', variant: 'warning' },
  missed: { label: 'No respondió', variant: 'destructive' },
  abandoned: { label: 'Abandonada', variant: 'destructive' },
};

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboardToday();

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando...</p>;
  }
  if (isError) {
    return <p className="text-destructive">Error: {(error as Error).message}</p>;
  }
  if (!data) return null;

  const { summary, clients } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen del día — {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Clientes activos" value={summary.totalClients} />
        <StatCard
          label="Sesiones hoy"
          value={summary.sessionsCreated}
          sub={summary.noSession > 0 ? `${summary.noSession} sin sesión` : undefined}
        />
        <StatCard
          label="En curso / Completadas"
          value={`${summary.inProgress} / ${summary.completed}`}
          sub={summary.greeted > 0 ? `${summary.greeted} esperando` : undefined}
        />
        <StatCard
          label="Alertas sin leer"
          value={summary.unreadNotifications}
          highlight={summary.unreadNotifications > 0}
          href="/notifications"
          sub={summary.failedMessages > 0 ? `${summary.failedMessages} mensajes fallidos 24h` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes de hoy</CardTitle>
          <CardDescription>Click en un cliente para ver detalle y conversación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {clients.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay clientes activos.
            </p>
          )}
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
  href?: string;
}) {
  const body = (
    <Card
      className={cn(
        'transition-colors',
        highlight && 'border-destructive/40 bg-destructive/5',
        href && 'hover:bg-accent/5 cursor-pointer',
      )}
    >
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn('text-3xl', highlight && 'text-destructive')}>{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
  return href ? <Link to={href}>{body}</Link> : body;
}

function ClientRow({ client }: { client: DashboardClient }) {
  const session = client.session;
  const statusMeta = session ? STATUS_META[session.status] : null;
  const progress =
    session && session.itemsTotal > 0
      ? Math.round((session.itemsDone / session.itemsTotal) * 100)
      : 0;

  return (
    <Link
      to={`/clients/${client.id}`}
      className="flex items-center gap-4 rounded-md px-3 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{client.name}</span>
          {statusMeta ? (
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          ) : (
            <Badge variant="secondary">Sin sesión</Badge>
          )}
        </div>
        {session ? (
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {session.itemsDone}/{session.itemsTotal}
              {session.itemsSkipped > 0 && ` · ${session.itemsSkipped} skip`}
            </span>
            <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            {session.greetedAt && (
              <span>Saludo {formatTime(session.greetedAt)}</span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {client.preferredStartTime
              ? `Saludo programado ${client.preferredStartTime}`
              : 'Día de descanso o fuera de plan'}
          </p>
        )}
      </div>
      <span className="text-muted-foreground text-sm">→</span>
    </Link>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
