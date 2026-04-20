import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Card, CardContent } from '@/components/atoms/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms/Table';
import type { PlanSummaryDto } from '@/features/plans/api';

const statusVariant: Record<PlanSummaryDto['status'], 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  draft: 'warning',
  archived: 'secondary',
};

const statusLabel: Record<PlanSummaryDto['status'], string> = {
  active: 'Activo',
  draft: 'Borrador',
  archived: 'Archivado',
};

export function PlanList({
  clientId,
  plans,
}: {
  clientId: string;
  plans: PlanSummaryDto[];
}) {
  const navigate = useNavigate();

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Todavia no hay planes para este cliente.
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
            <TableHead>Dias/sem</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((p) => (
            <TableRow
              key={p.id}
              onClick={() => navigate(`/clients/${clientId}/plans/${p.id}`)}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{p.daysPerWeek}</TableCell>
              <TableCell className="font-mono text-xs">
                {format(new Date(p.startDate), 'yyyy-MM-dd')}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {format(new Date(p.endDate), 'yyyy-MM-dd')}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
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
