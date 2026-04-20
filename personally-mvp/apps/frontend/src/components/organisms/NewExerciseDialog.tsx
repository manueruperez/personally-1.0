import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCreateExercise } from '@/features/exercises/hooks';

const schema = z.object({
  nameEs: z.string().min(1, 'Requerido').max(120),
  muscleprimary: z.string().optional(),
  equipment: z.string().optional(),
  instructions: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

function splitCsv(s?: string): string[] {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function NewExerciseDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateExercise();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    await create.mutateAsync({
      nameEs: values.nameEs,
      muscleprimary: splitCsv(values.muscleprimary),
      equipment: splitCsv(values.equipment),
      instructions: values.instructions || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo ejercicio</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ejercicio custom</DialogTitle>
          <DialogDescription>
            Se guarda en tu catalogo privado (fuente: custom). Podes usarlo en cualquier plan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nameEs">Nombre</Label>
            <Input id="nameEs" autoFocus {...register('nameEs')} />
            {errors.nameEs && <p className="text-xs text-destructive">{errors.nameEs.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="muscleprimary">Musculos primarios (separados por coma)</Label>
            <Input
              id="muscleprimary"
              placeholder="cuadriceps, gluteos"
              {...register('muscleprimary')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="equipment">Equipamiento (separados por coma)</Label>
            <Input id="equipment" placeholder="barra, banco" {...register('equipment')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instrucciones</Label>
            <textarea
              id="instructions"
              rows={4}
              {...register('instructions')}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {create.isError && (
            <p className="text-sm text-destructive">
              {(create.error as Error)?.message ?? 'No se pudo crear'}
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
