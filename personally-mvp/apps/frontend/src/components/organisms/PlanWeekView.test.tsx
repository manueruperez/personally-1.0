import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { PlanDayDto, PlanWeekDto } from '@/features/plans/api';

const addDayMutateAsync = vi.fn();
const deleteDayMutateAsync = vi.fn();
const noopMutation = () => ({ mutateAsync: vi.fn(), isPending: false });

vi.mock('@/features/plans/hooks', () => ({
  useAddPlanDay: () => ({ mutateAsync: addDayMutateAsync, isPending: false }),
  useDeletePlanDay: () => ({ mutateAsync: deleteDayMutateAsync, isPending: false }),
  useAddPlanItem: () => noopMutation(),
  useDeletePlanItem: () => noopMutation(),
  useUpdatePlanItem: () => noopMutation(),
}));

// ExercisePickerDialog consulta el catalogo; lo neutralizamos para no pegarle a la red.
vi.mock('@/features/exercises/hooks', () => ({
  useSearchExercises: () => ({ data: { data: [], total: 0 }, isLoading: false }),
}));

const { PlanWeekView } = await import('./PlanWeekView');

function makeDay(overrides: Partial<PlanDayDto> = {}): PlanDayDto {
  return {
    id: 'day-1',
    dayOfWeek: 1,
    focus: 'Tren superior',
    estimatedDurationMin: null,
    isRestDay: false,
    notes: null,
    items: [],
    ...overrides,
  };
}

function makeWeek(overrides: Partial<PlanWeekDto> = {}): PlanWeekDto {
  return {
    id: 'week-1',
    weekNumber: 1,
    phase: 'load',
    notes: null,
    days: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlanWeekView — agregar dia', () => {
  it('semana vacia con canEditDays ofrece agregar dia ademas del CSV', () => {
    renderWithProviders(<PlanWeekView week={makeWeek()} planId="plan-1" canEditDays />);

    expect(screen.getByRole('button', { name: /agregar d[ií]a/i })).toBeInTheDocument();
    // El copy ya no obliga a pasar por el CSV.
    expect(screen.getByText(/o agreg[áa] d[ií]as manualmente/i)).toBeInTheDocument();
  });

  it('semana vacia sin canEditDays no muestra el boton (plan activo/archivado)', () => {
    renderWithProviders(<PlanWeekView week={makeWeek()} planId="plan-1" />);

    expect(screen.queryByRole('button', { name: /agregar d[ií]a/i })).not.toBeInTheDocument();
    expect(screen.getByText(/importa el csv/i)).toBeInTheDocument();
  });

  it('elegir un dia y confirmar llama a useAddPlanDay con weekId + payload', async () => {
    const user = userEvent.setup();
    addDayMutateAsync.mockResolvedValue({ id: 'day-new' });

    renderWithProviders(<PlanWeekView week={makeWeek()} planId="plan-1" canEditDays />);

    await user.click(screen.getByRole('button', { name: /agregar d[ií]a/i }));
    await user.click(screen.getByRole('button', { name: 'Mar' }));
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(addDayMutateAsync).toHaveBeenCalledWith({
      weekId: 'week-1',
      body: { dayOfWeek: 2, focus: null, isRestDay: false },
    });
  });

  it('los dias ya usados aparecen deshabilitados en el dialog', async () => {
    const user = userEvent.setup();
    const week = makeWeek({
      days: [makeDay({ id: 'day-1', dayOfWeek: 1 }), makeDay({ id: 'day-3', dayOfWeek: 3 })],
    });

    renderWithProviders(<PlanWeekView week={week} planId="plan-1" canEditDays />);

    await user.click(screen.getByRole('button', { name: /agregar d[ií]a/i }));

    expect(screen.getByRole('button', { name: 'Lun' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mar' })).toBeEnabled();
  });

  it('no ofrece agregar dia cuando la semana ya tiene los 7 dias', () => {
    const week = makeWeek({
      days: [1, 2, 3, 4, 5, 6, 7].map((d) => makeDay({ id: `day-${d}`, dayOfWeek: d })),
    });

    renderWithProviders(<PlanWeekView week={week} planId="plan-1" canEditDays />);

    expect(screen.queryByRole('button', { name: /^agregar d[ií]a$/i })).not.toBeInTheDocument();
  });
});

describe('PlanWeekView — eliminar dia', () => {
  it('trash con confirm aceptado llama a useDeletePlanDay con el id del dia', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteDayMutateAsync.mockResolvedValue({ deleted: true });

    const week = makeWeek({ days: [makeDay({ id: 'day-42', dayOfWeek: 2 })] });
    renderWithProviders(<PlanWeekView week={week} planId="plan-1" canEditDays />);

    await user.click(screen.getByRole('button', { name: /eliminar dia mar/i }));

    expect(deleteDayMutateAsync).toHaveBeenCalledWith('day-42');
  });

  it('trash con confirm cancelado no borra', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const week = makeWeek({ days: [makeDay({ id: 'day-42', dayOfWeek: 2 })] });
    renderWithProviders(<PlanWeekView week={week} planId="plan-1" canEditDays />);

    await user.click(screen.getByRole('button', { name: /eliminar dia mar/i }));

    expect(deleteDayMutateAsync).not.toHaveBeenCalled();
  });

  it('sin canEditDays no hay trash de dia', () => {
    const week = makeWeek({ days: [makeDay({ id: 'day-42', dayOfWeek: 2 })] });
    renderWithProviders(<PlanWeekView week={week} planId="plan-1" />);

    expect(screen.queryByRole('button', { name: /eliminar dia/i })).not.toBeInTheDocument();
  });
});
