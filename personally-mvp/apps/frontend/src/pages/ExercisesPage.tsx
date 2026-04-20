import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Card, CardContent } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { ExerciseList } from '@/components/organisms/ExerciseList';
import { NewExerciseDialog } from '@/components/organisms/NewExerciseDialog';
import { useSearchExercises } from '@/features/exercises/hooks';

const PAGE_SIZE = 20;

export function ExercisesPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useSearchExercises({
    q: query || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Ejercicios</h1>
          <p className="text-muted-foreground">
            Catalogo publico + tus ejercicios custom. Se usa al armar planes.
          </p>
        </div>
        <NewExerciseDialog />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre..."
          className="pl-9"
        />
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

      {data && (
        <>
          <ExerciseList exercises={data.data} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {total} ejercicios · pag {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
