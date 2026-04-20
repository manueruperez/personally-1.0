import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/lib/utils';
import { useTodaySession } from '@/features/clients/hooks';
import type { LogStatus, SessionStatus, TodaySessionLog } from '@/features/clients/api';

const SESSION_STATUS_META: Record<
  SessionStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  scheduled: { label: 'Programada', variant: 'secondary' },
  greeted: { label: 'Saludada, esperando iniciar', variant: 'warning' },
  in_progress: { label: 'En progreso', variant: 'default' },
  completed: { label: 'Completada', variant: 'success' },
  partial: { label: 'Parcial', variant: 'warning' },
  missed: { label: 'No respondió', variant: 'destructive' },
  abandoned: { label: 'Abandonada', variant: 'destructive' },
};

const LOG_STATUS_META: Record<LogStatus, { label: string; className: string }> = {
  pending: { label: '○', className: 'text-muted-foreground' },
  presented: { label: '▶', className: 'text-primary font-semibold' },
  done: { label: '✓', className: 'text-primary' },
  skipped: { label: '⏭', className: 'text-muted-foreground' },
  changed: { label: '↻', className: 'text-accent' },
  missed: { label: '✗', className: 'text-destructive' },
  deferred: { label: '⏳', className: 'text-accent' },
};

const BLOCK_LABEL: Record<TodaySessionLog['block'], string> = {
  warmup: 'Calentamiento',
  exercise: 'Ejercicio',
  cooldown: 'Vuelta a la calma',
};

export function TodaySessionCard({ clientId }: { clientId: string }) {
  const { data: session, isLoading } = useTodaySession(clientId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sesión de hoy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Cargando...</CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sesión de hoy</CardTitle>
          <CardDescription>
            Aún no hay sesión. Se crea al enviar el saludo o cuando el cliente responde.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const meta = SESSION_STATUS_META[session.status];
  const progress =
    session.itemsTotal > 0 ? Math.round((session.itemsDone / session.itemsTotal) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Sesión de hoy</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <span className="text-sm text-muted-foreground">
              {session.itemsDone}/{session.itemsTotal} hechos
              {session.itemsSkipped > 0 && ` · ${session.itemsSkipped} saltados`}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
          {session.greetedAt && <div>Saludo: {formatTime(session.greetedAt)}</div>}
          {session.startedAt && <div>Inicio: {formatTime(session.startedAt)}</div>}
          {session.finishedAt && <div>Fin: {formatTime(session.finishedAt)}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ProgressBar percent={progress} />
        <ol className="space-y-1 text-sm">
          {session.logs.map((log) => {
            const logMeta = LOG_STATUS_META[log.status];
            const isActive = log.status === 'presented';
            return (
              <li
                key={log.id}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-1.5',
                  isActive && 'bg-primary/5 ring-1 ring-primary/20',
                )}
              >
                <span className={cn('w-5 text-center', logMeta.className)}>{logMeta.label}</span>
                {log.exerciseImageUrl ? (
                  <img
                    src={log.exerciseImageUrl}
                    alt={log.exerciseName}
                    loading="lazy"
                    className="h-8 w-8 rounded object-cover bg-muted shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted shrink-0" aria-hidden="true" />
                )}
                <span className="text-xs text-muted-foreground uppercase tracking-wide w-20 shrink-0">
                  {BLOCK_LABEL[log.block]}
                </span>
                <span className="flex-1 truncate">{log.exerciseName}</span>
                {(log.sets || log.reps) && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {log.sets ? `${log.sets}×` : ''}
                    {log.reps ?? ''}
                  </span>
                )}
                {log.deferCount > 0 && (
                  <span className="text-xs text-accent shrink-0" title="Diferido">
                    +{log.deferCount}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
