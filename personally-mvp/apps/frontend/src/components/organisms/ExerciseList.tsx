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
import type { ExerciseDto } from '@/features/exercises/api';

const sourceLabel: Record<ExerciseDto['source'], string> = {
  free_exercise_db: 'Publico',
  custom: 'Custom',
  exercisedb: 'ExerciseDB',
};

const sourceVariant: Record<ExerciseDto['source'], 'secondary' | 'success' | 'outline'> = {
  free_exercise_db: 'outline',
  custom: 'success',
  exercisedb: 'secondary',
};

export function ExerciseList({ exercises }: { exercises: ExerciseDto[] }) {
  if (exercises.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No hay ejercicios que coincidan con tu busqueda.
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
            <TableHead>Musculos</TableHead>
            <TableHead>Equipamiento</TableHead>
            <TableHead>Fuente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exercises.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">
                {e.nameEs}
                {e.nameEn && e.nameEn !== e.nameEs && (
                  <span className="text-muted-foreground text-xs font-normal ml-2">
                    {e.nameEn}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {e.muscleprimary.join(', ') || '—'}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {e.equipment.join(', ') || '—'}
              </TableCell>
              <TableCell>
                <Badge variant={sourceVariant[e.source]}>{sourceLabel[e.source]}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
