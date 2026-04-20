import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/Dialog';
import { cn } from '@/lib/utils';
import { useSearchExercises } from '@/features/exercises/hooks';
import type { ExerciseDto } from '@/features/exercises/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentExerciseId?: string;
  onSelect: (exercise: ExerciseDto) => void | Promise<void>;
}

export function ExercisePickerDialog({ open, onOpenChange, currentExerciseId, onSelect }: Props) {
  const [q, setQ] = useState('');
  const { data, isLoading } = useSearchExercises({ q, pageSize: 30 });

  async function pick(ex: ExerciseDto) {
    await onSelect(ex);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cambiar ejercicio</DialogTitle>
          <DialogDescription>
            Buscá en el catálogo y seleccioná el reemplazo. Las sesiones ya iniciadas conservan el
            ejercicio original.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, músculo, equipo..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">Buscando...</p>
          )}
          {data?.data.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay resultados para "{q}".
            </p>
          )}
          {data?.data.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => void pick(ex)}
              disabled={ex.id === currentExerciseId}
              className={cn(
                'flex items-center gap-3 w-full text-left rounded-md border px-3 py-2 text-sm transition-colors',
                'hover:bg-muted/50',
                ex.id === currentExerciseId && 'opacity-50 cursor-default bg-muted/30',
              )}
            >
              {ex.imageUrl ? (
                <img
                  src={ex.imageUrl}
                  alt={ex.nameEs}
                  loading="lazy"
                  className="h-10 w-10 rounded object-cover bg-muted shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted shrink-0" aria-hidden="true" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{ex.nameEs}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[ex.muscleprimary?.join(', '), ex.equipment?.join(', ')]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </div>
              {ex.id === currentExerciseId && (
                <span className="text-xs text-muted-foreground shrink-0">actual</span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
