import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { EditableCell } from '@/components/atoms/EditableCell';
import { ExercisePickerDialog } from '@/components/organisms/ExercisePickerDialog';
import { cn } from '@/lib/utils';
import { useAddPlanItem, useDeletePlanItem, useUpdatePlanItem } from '@/features/plans/hooks';
import type { PlanWeekDto, PlanItemDto } from '@/features/plans/api';

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

interface Props {
  week: PlanWeekDto;
  planId: string;
  editable?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
}

export function PlanWeekView({
  week,
  planId,
  editable = true,
  canDelete,
  onDelete,
  deleting,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold">Semana {week.weekNumber}</h2>
        {canDelete && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar semana
          </Button>
        )}
      </div>

      {week.days.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Semana {week.weekNumber} sin dias cargados.
            <p className="text-xs mt-2">Importa el CSV para poblar los ejercicios.</p>
          </CardContent>
        </Card>
      ) : (
        week.days.map((day) => (
          <Card key={day.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {DAY_NAMES[day.dayOfWeek]}
                    {day.focus && (
                      <span className="text-sm text-muted-foreground font-normal">
                        · {day.focus}
                      </span>
                    )}
                  </CardTitle>
                  {day.estimatedDurationMin && (
                    <CardDescription>~{day.estimatedDurationMin} min</CardDescription>
                  )}
                </div>
                {day.isRestDay && <Badge variant="secondary">Descanso</Badge>}
              </div>
            </CardHeader>
            {!day.isRestDay && (
              <CardContent className="space-y-4">
                <Block
                  title="Warmup"
                  block="warmup"
                  dayId={day.id}
                  items={day.items.filter((i) => i.block === 'warmup')}
                  planId={planId}
                  editable={editable}
                />
                <Block
                  title="Ejercicios"
                  block="exercise"
                  dayId={day.id}
                  items={day.items.filter((i) => i.block === 'exercise')}
                  planId={planId}
                  editable={editable}
                />
                <Block
                  title="Cooldown"
                  block="cooldown"
                  dayId={day.id}
                  items={day.items.filter((i) => i.block === 'cooldown')}
                  planId={planId}
                  editable={editable}
                />
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function Block({
  title,
  block,
  dayId,
  items,
  planId,
  editable,
}: {
  title: string;
  block: 'warmup' | 'exercise' | 'cooldown';
  dayId: string;
  items: PlanItemDto[];
  planId: string;
  editable: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addItem = useAddPlanItem(planId);

  // Si no hay items y no es editable, no mostrar el bloque (no hay nada para ver ni editar).
  if (items.length === 0 && !editable) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">{title}</h4>
        {editable && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Agregar
          </button>
        )}
      </div>
      <div className="space-y-1">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} planId={planId} editable={editable} />
        ))}
        {items.length === 0 && editable && (
          <p className="text-xs text-muted-foreground italic py-2">
            Sin items. "Agregar" para sumar un ejercicio.
          </p>
        )}
      </div>
      {editable && (
        <ExercisePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={async (ex) => {
            await addItem.mutateAsync({ dayId, body: { exerciseId: ex.id, block } });
          }}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  planId,
  editable,
}: {
  item: PlanItemDto;
  planId: string;
  editable: boolean;
}) {
  const update = useUpdatePlanItem(planId);
  const remove = useDeletePlanItem(planId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(Boolean(item.cues || item.notes));
  const hasExtras = Boolean(item.cues || item.notes);

  async function commit(field: 'sets' | 'reps' | 'restSeconds' | 'rpeTarget', next: string | number | null) {
    await update.mutateAsync({
      itemId: item.id,
      body: { [field]: next } as Record<string, string | number | null>,
    });
  }

  async function commitText(field: 'cues' | 'notes', value: string) {
    const trimmed = value.trim();
    const next = trimmed === '' ? null : trimmed;
    const original = (item[field] ?? '').trim();
    if (next === null && original === '') return;
    if (next === original) return;
    await update.mutateAsync({ itemId: item.id, body: { [field]: next } });
  }

  return (
    <div className="border rounded-md">
    <div className="flex items-center gap-3 text-sm px-3 py-2">
      <span className="text-muted-foreground font-mono text-xs w-6">{item.orderIndex + 1}</span>
      {item.exercise.imageUrl ? (
        <img
          src={item.exercise.imageUrl}
          alt={item.exercise.nameEs}
          loading="lazy"
          className="h-10 w-10 rounded object-cover bg-muted shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="h-10 w-10 rounded bg-muted shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        disabled={!editable}
        onClick={() => setPickerOpen(true)}
        className={cn(
          'flex-1 font-medium text-left rounded px-2 py-1 -mx-2 transition-colors',
          editable && 'hover:bg-muted/70 cursor-pointer',
          !editable && 'cursor-default',
        )}
        title={editable ? 'Click para cambiar ejercicio' : undefined}
      >
        {item.exercise.nameEs}
      </button>
      {editable && (
        <ExercisePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          currentExerciseId={item.exerciseId}
          onSelect={async (ex) => {
            await update.mutateAsync({ itemId: item.id, body: { exerciseId: ex.id } });
          }}
        />
      )}

      <div className="flex items-center gap-1.5">
        <EditableCell
          value={item.sets}
          placeholder="—"
          fieldType="number"
          widthClass="w-12"
          disabled={!editable}
          onCommit={(v) => commit('sets', v)}
        />
        <span className="text-muted-foreground text-xs">x</span>
        <EditableCell
          value={item.reps}
          placeholder="—"
          fieldType="text"
          widthClass="w-14"
          disabled={!editable}
          onCommit={(v) => commit('reps', v)}
        />
      </div>

      <EditableCell
        value={item.restSeconds}
        placeholder="rest"
        fieldType="number"
        widthClass="w-14"
        suffix="s"
        disabled={!editable}
        onCommit={(v) => commit('restSeconds', v)}
      />

      {editable ? (
        <EditableCell
          value={item.rpeTarget}
          placeholder="RPE"
          fieldType="number"
          widthClass="w-12"
          disabled={!editable}
          onCommit={(v) => commit('rpeTarget', v)}
        />
      ) : (
        item.rpeTarget != null && (
          <Badge variant="outline" className="text-xs">
            RPE {item.rpeTarget}
          </Badge>
        )
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0',
          hasExtras && 'text-primary',
        )}
        title={expanded ? 'Ocultar notas' : hasExtras ? 'Ver notas' : 'Agregar notas'}
        aria-label="Toggle notas"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {editable && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Quitar "${item.exercise.nameEs}" del plan?`)) {
              void remove.mutateAsync(item.id);
            }
          }}
          disabled={remove.isPending}
          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title="Quitar ejercicio"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>

    {expanded && (
      <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
        <ExpandableTextField
          label="Cues (técnica)"
          placeholder="Ej: controla la bajada 3 segundos, empuja con los talones..."
          value={item.cues ?? ''}
          disabled={!editable}
          onCommit={(v) => commitText('cues', v)}
        />
        <ExpandableTextField
          label="Notas"
          placeholder="Ej: progresión semanal, tomar videos, avisar si duele..."
          value={item.notes ?? ''}
          disabled={!editable}
          onCommit={(v) => commitText('notes', v)}
        />
      </div>
    )}
    </div>
  );
}

function ExpandableTextField({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (v: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (saving || draft === value) return;
    setSaving(true);
    try {
      await onCommit(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void handleBlur()}
        placeholder={placeholder}
        disabled={disabled || saving}
        rows={2}
        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50 resize-none"
      />
    </div>
  );
}
