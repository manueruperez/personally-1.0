import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Card, CardContent } from '@/components/atoms/Card';
import { PlanWeekView } from '@/components/organisms/PlanWeekView';
import { ImportPlanCsvDialog } from '@/components/organisms/ImportPlanCsvDialog';
import {
  useActivatePlan,
  useAddPlanWeek,
  useArchivePlan,
  useDeletePlanWeek,
  usePlan,
  useRevertPlanToDraft,
} from '@/features/plans/hooks';
import { cn } from '@/lib/utils';

export function PlanEditorPage() {
  const { clientId, planId } = useParams();
  const { data: plan, isLoading, isError, error } = usePlan(planId);
  const activate = useActivatePlan();
  const archive = useArchivePlan();
  const revert = useRevertPlanToDraft();
  const deleteWeek = useDeletePlanWeek(planId ?? '');
  const addWeek = useAddPlanWeek(planId ?? '');
  const [selectedWeek, setSelectedWeek] = useState(1);

  if (isLoading) return <p className="text-muted-foreground">Cargando...</p>;
  if (isError) return <p className="text-destructive">Error: {(error as Error).message}</p>;
  if (!plan) return null;

  const week = plan.weeks.find((w) => w.weekNumber === selectedWeek) ?? plan.weeks[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={`/clients/${clientId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Cliente
          </Link>
          <h1 className="text-2xl font-heading font-semibold mt-1">{plan.name}</h1>
          <p className="text-muted-foreground text-sm">
            {plan.daysPerWeek} dias/sem · {format(new Date(plan.startDate), 'yyyy-MM-dd')} →{' '}
            {format(new Date(plan.endDate), 'yyyy-MM-dd')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              plan.status === 'active'
                ? 'success'
                : plan.status === 'draft'
                  ? 'warning'
                  : 'secondary'
            }
          >
            {plan.status}
          </Badge>
          {plan.status === 'draft' && <ImportPlanCsvDialog planId={plan.id} />}
          {plan.status === 'draft' && (
            <Button
              size="sm"
              onClick={() => activate.mutate(plan.id)}
              disabled={activate.isPending}
            >
              Activar
            </Button>
          )}
          {plan.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => revert.mutate(plan.id)}
              disabled={revert.isPending}
            >
              Volver a draft
            </Button>
          )}
          {plan.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => archive.mutate(plan.id)}
              disabled={archive.isPending}
            >
              Archivar
            </Button>
          )}
          {revert.isError && (
            <p className="text-xs text-destructive">
              {(revert.error as Error).message}
            </p>
          )}
        </div>
      </div>

      {plan.goal && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">{plan.goal}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1 items-center border-b pb-0">
        {plan.weeks.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedWeek(w.weekNumber)}
            className={cn(
              'min-w-[2.5rem] h-9 px-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors',
              w.weekNumber === selectedWeek
                ? 'border-primary text-foreground font-medium bg-muted/40'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30',
            )}
          >
            {w.weekNumber}
          </button>
        ))}
        {plan.status === 'draft' && (
          <button
            onClick={() => addWeek.mutate()}
            disabled={addWeek.isPending}
            title="Agregar semana al final"
            className="min-w-[2.5rem] h-9 px-2 text-sm rounded-t-md border-b-2 -mb-px border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mx-auto" />
          </button>
        )}
      </div>

      {week && (
        <PlanWeekView
          week={week}
          planId={plan.id}
          editable={plan.status !== 'archived'}
          canDelete={plan.status === 'draft' && plan.weeks.length > 1}
          deleting={deleteWeek.isPending}
          onDelete={() => {
            if (
              window.confirm(
                `Eliminar semana ${week.weekNumber}? Se borraran sus dias e items.`,
              )
            ) {
              deleteWeek.mutate(week.weekNumber, {
                onSuccess: () => {
                  const remaining = plan.weeks.filter(
                    (w2) => w2.weekNumber !== week.weekNumber,
                  );
                  setSelectedWeek(remaining[0]?.weekNumber ?? 1);
                },
              });
            }
          }}
        />
      )}
    </div>
  );
}
