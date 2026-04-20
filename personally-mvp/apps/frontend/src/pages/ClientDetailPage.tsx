import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/atoms/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card';
import { EditClientDialog } from '@/components/organisms/EditClientDialog';
import { ArchiveClientButton } from '@/components/organisms/ArchiveClientButton';
import { ClientPlansSection } from '@/components/organisms/ClientPlansSection';
import { QuickSendMessage } from '@/components/organisms/QuickSendMessage';
import { ClientConversation } from '@/components/organisms/ClientConversation';
import { TodaySessionCard } from '@/components/organisms/TodaySessionCard';
import { useClient } from '@/features/clients/hooks';

export function ClientDetailPage() {
  const { id } = useParams();
  const { data: client, isLoading, isError, error } = useClient(id);

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando...</p>;
  }
  if (isError) {
    return <p className="text-destructive">Error: {(error as Error).message}</p>;
  }
  if (!client) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/clients" className="text-sm text-muted-foreground hover:underline">
            ← Clientes
          </Link>
          <h1 className="text-2xl font-heading font-semibold mt-1">{client.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">{client.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{client.status}</Badge>
          <EditClientDialog client={client} />
          {client.status !== 'archived' && (
            <ArchiveClientButton clientId={client.id} clientName={client.name} />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Email" value={client.email ?? '—'} />
            <Row
              label="Alta"
              value={format(new Date(client.createdAt), 'yyyy-MM-dd HH:mm')}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
            <CardDescription>Cuando y como recibe la rutina.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Timezone" value={client.preferences?.timezone ?? '—'} />
            <Row
              label="Hora preferida"
              value={client.preferences?.preferredStartTime ?? '—'}
            />
            <Row
              label="Recordatorios"
              value={client.preferences?.reminderEnabled ? 'Activos' : 'Apagados'}
            />
          </CardContent>
        </Card>
      </div>


      <TodaySessionCard clientId={client.id} />

      <ClientConversation clientId={client.id} />
      {client.status === 'active' && (
        <QuickSendMessage clientId={client.id} clientPhone={client.phone} />
      )}

      <ClientPlansSection clientId={client.id} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
