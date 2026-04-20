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
import { useCreateClient } from '@/features/clients/hooks';

const schema = z.object({
  name: z.string().min(1, 'Requerido').max(120),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'Formato E.164 (ej. +573001234567)'),
  email: z.string().email().optional().or(z.literal('')),
  timezone: z.string().default('America/Bogota'),
  preferredStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:mm')
    .default('05:00'),
});

type FormValues = z.infer<typeof schema>;

export function NewClientDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      timezone: 'America/Bogota',
      preferredStartTime: '05:00',
    },
  });

  async function onSubmit(values: FormValues) {
    await create.mutateAsync({
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      preferences: {
        timezone: values.timezone,
        preferredStartTime: values.preferredStartTime,
      },
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo cliente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            El numero se usara para enviar la rutina por WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" autoFocus {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefono (E.164)</Label>
            <Input
              id="phone"
              placeholder="+573001234567"
              inputMode="tel"
              {...register('phone')}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" {...register('timezone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredStartTime">Hora preferida</Label>
              <Input id="preferredStartTime" {...register('preferredStartTime')} />
              {errors.preferredStartTime && (
                <p className="text-xs text-destructive">{errors.preferredStartTime.message}</p>
              )}
            </div>
          </div>
          {create.isError && (
            <p className="text-sm text-destructive">
              {(create.error as Error)?.message ?? 'No se pudo crear el cliente'}
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
