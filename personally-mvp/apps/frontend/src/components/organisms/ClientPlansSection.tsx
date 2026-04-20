import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card';
import { NewPlanDialog } from './NewPlanDialog';
import { PlanList } from './PlanList';
import { usePlansByClient } from '@/features/plans/hooks';

export function ClientPlansSection({ clientId }: { clientId: string }) {
  const { data, isLoading, isError } = usePlansByClient(clientId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Planes</CardTitle>
          <CardDescription>El plan trimestral que disenas tu.</CardDescription>
        </div>
        <NewPlanDialog clientId={clientId} />
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-center text-muted-foreground py-6">Cargando...</p>}
        {isError && <p className="text-center text-destructive py-6">Error</p>}
        {data && <PlanList clientId={clientId} plans={data} />}
      </CardContent>
    </Card>
  );
}
