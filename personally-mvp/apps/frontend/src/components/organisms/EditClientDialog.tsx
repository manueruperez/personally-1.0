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
import { useUpdateClient } from '@/features/clients/hooks';
import type { ClientDto } from '@/features/clients/api';

const schema = z.object({
  name: z.string().min(1, 'Requerido').max(120),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Formato E.164 (ej. +573001234567)'),
  email: z.string().email().optional().or(z.literal('')),
  status: z.enum(['active', 'paused', 'archived']),
  timezone: z.string(),
  preferredStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:mm'),
  reminderEnabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function EditClientDialog({ client }: { client: ClientDto }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateClient(client.id);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: client.name,
      phone: client.phone,
      email: client.email ?? '',
      status: client.status,
      timezone: client.preferences?.timezone ?? 'America/Bogota',
      preferredStartTime: client.preferences?.preferredStartTime ?? '05:00',
      reminderEnabled: client.preferences?.reminderEnabled ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    await update.mutateAsync({
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      status: values.status,
      preferences: {
        timezone: values.timezone,
        preferredStartTime: values.preferredStartTime,
        reminderEnabled: values.reminderEnabled,
      },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Actualiza los datos y preferencias.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input id="phone" inputMode="tel" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                {...register('status')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredStartTime">Hora preferida</Label>
              <Input id="preferredStartTime" {...register('preferredStartTime')} />
              {errors.preferredStartTime && (
                <p className="text-xs text-destructive">{errors.preferredStartTime.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" {...register('timezone')} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('reminderEnabled')} />
            Enviar recordatorios diarios
          </label>
          {update.isError && (
            <p className="text-sm text-destructive">
              {(update.error as Error)?.message ?? 'No se pudo actualizar'}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
