import { useState } from 'react';
import { ClientList } from '@/components/organisms/ClientList';
import { NewClientDialog } from '@/components/organisms/NewClientDialog';
import { Card, CardContent } from '@/components/atoms/Card';
import { useClients } from '@/features/clients/hooks';
import type { ClientStatusFilter } from '@/features/clients/api';
import { cn } from '@/lib/utils';

const FILTERS: { value: ClientStatusFilter; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'archived', label: 'Archivados' },
  { value: 'all', label: 'Todos' },
];

export function ClientsPage() {
  const [filter, setFilter] = useState<ClientStatusFilter>('active');
  const { data, isLoading, isError, error } = useClients(filter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Clientes</h1>
          <p className="text-muted-foreground">
            Los clientes reciben su rutina diaria por WhatsApp.
          </p>
        </div>
        <NewClientDialog />
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
          <CardContent className="py-12 text-center text-muted-foreground">
            Cargando...
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Error: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && <ClientList clients={data} />}
    </div>
  );
}
