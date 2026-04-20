import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addWeeks, format } from 'date-fns';
import { Button } from '@/components/atoms/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/atoms/Dialog';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { useCreatePlanDraft } from '@/features/plans/hooks';

const schema = z.object({
  name: z.string().min(1, 'Requerido').max(120),
  goal: z.string().max(500).optional(),
  daysPerWeek: z.coerce.number().int().min(3).max(5),
  startDate: z.string().min(1, 'Requerido'),
  totalWeeks: z.coerce.number().int().min(12).max(52),
});

type FormValues = z.infer<typeof schema>;

export function NewPlanDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreatePlanDraft(clientId);

  const today = format(new Date(), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      daysPerWeek: 3,
      startDate: today,
      totalWeeks: 12,
    },
  });

  const startDate = watch('startDate');
  const totalWeeks = watch('totalWeeks');
  const endDatePreview = startDate
    ? format(addWeeks(new Date(startDate), Number(totalWeeks) || 12), 'yyyy-MM-dd')
    : '—';

  async function onSubmit(values: FormValues) {
    const start = new Date(values.startDate);
    const end = addWeeks(start, values.totalWeeks);
    await create.mutateAsync({
      name: values.name,
      goal: values.goal || undefined,
      daysPerWeek: values.daysPerWeek,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalWeeks: values.totalWeeks,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo plan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo plan</DialogTitle>
          <DialogDescription>
            Crea el contenedor del plan. Los ejercicios se cargan despues desde el CSV.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" autoFocus placeholder="Hipertrofia Q2 2026" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Objetivo (opcional)</Label>
            <Input id="goal" {...register('goal')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daysPerWeek">Dias/semana</Label>
              <select
                id="daysPerWeek"
                {...register('daysPerWeek')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalWeeks">Semanas</Label>
              <Input id="totalWeeks" type="number" min={12} max={52} {...register('totalWeeks')} />
              {errors.totalWeeks && (
                <p className="text-xs text-destructive">{errors.totalWeeks.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Inicio</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Fin estimado: <span className="font-mono">{endDatePreview}</span>
          </p>
          {create.isError && (
            <p className="text-sm text-destructive">
              {(create.error as Error)?.message ?? 'No se pudo crear el plan'}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
