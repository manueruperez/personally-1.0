import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/Dialog';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { cn } from '@/lib/utils';
import type { AddPlanDayPayload } from '@/features/plans/api';

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usedDays: number[];
  onSubmit: (payload: AddPlanDayPayload) => void | Promise<void>;
  submitting?: boolean;
}

export function AddPlanDayDialog({ open, onOpenChange, usedDays, onSubmit, submitting }: Props) {
  const firstFree = ALL_DAYS.find((d) => !usedDays.includes(d));
  const [dayOfWeek, setDayOfWeek] = useState<number | undefined>(firstFree);
  const [focus, setFocus] = useState('');
  const [isRestDay, setIsRestDay] = useState(false);

  // Al abrir, resetear el form al primer dia libre disponible.
  useEffect(() => {
    if (open) {
      setDayOfWeek(ALL_DAYS.find((d) => !usedDays.includes(d)));
      setFocus('');
      setIsRestDay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    if (dayOfWeek === undefined) return;
    const trimmed = focus.trim();
    await onSubmit({
      dayOfWeek,
      focus: trimmed === '' ? null : trimmed,
      isRestDay,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar dia</DialogTitle>
          <DialogDescription>
            Elegi el dia de la semana. Despues sumas los ejercicios desde el editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dia de la semana</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => {
                const used = usedDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={used}
                    aria-pressed={dayOfWeek === d}
                    onClick={() => setDayOfWeek(d)}
                    className={cn(
                      'h-9 min-w-[3rem] px-3 rounded-md border text-sm transition-colors',
                      dayOfWeek === d
                        ? 'border-primary bg-primary text-primary-foreground font-medium'
                        : 'border-input hover:bg-muted',
                      used && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                    )}
                    title={used ? 'Ya existe un dia para este dia de la semana' : undefined}
                  >
                    {DAY_NAMES[d]}
                  </button>
                );
              })}
            </div>
            {dayOfWeek === undefined && (
              <p className="text-xs text-muted-foreground">
                La semana ya tiene los 7 dias cargados.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="focus">Focus (opcional)</Label>
            <Input
              id="focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Ej: Tren superior, Pierna, Full body"
              maxLength={200}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isRestDay"
              type="checkbox"
              checked={isRestDay}
              onChange={(e) => setIsRestDay(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isRestDay" className="cursor-pointer">
              Dia de descanso
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || dayOfWeek === undefined}
          >
            {submitting ? 'Agregando...' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
