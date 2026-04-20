import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms/Table';
import { Card, CardContent } from '@/components/atoms/Card';
import type { ClientDto } from '@/features/clients/api';

const statusVariant: Record<ClientDto['status'], 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  paused: 'warning',
  archived: 'secondary',
};

const statusLabel: Record<ClientDto['status'], string> = {
  active: 'Activo',
  paused: 'Pausado',
  archived: 'Archivado',
};

export function ClientList({ clients }: { clients: ClientDto[] }) {
  const navigate = useNavigate();

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Todavia no tenes clientes. Crea el primero.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Telefono</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead className="w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow
              key={c.id}
              onClick={() => navigate(`/clients/${c.id}`)}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="font-mono text-xs">{c.phone}</TableCell>
              <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {format(new Date(c.createdAt), 'yyyy-MM-dd')}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
