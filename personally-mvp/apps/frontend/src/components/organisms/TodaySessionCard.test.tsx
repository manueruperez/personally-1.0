import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { TodaySessionDto } from '@/features/clients/api';

const useTodaySessionMock = vi.fn();
vi.mock('@/features/clients/hooks', () => ({
  useTodaySession: (clientId: string | undefined) => useTodaySessionMock(clientId),
}));

const { TodaySessionCard } = await import('./TodaySessionCard');

function makeSession(overrides: Partial<TodaySessionDto> = {}): TodaySessionDto {
  return {
    id: 's1',
    status: 'greeted',
    scheduledDate: new Date().toISOString(),
    greetedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    itemsTotal: 2,
    itemsDone: 0,
    itemsSkipped: 0,
    logs: [
      {
        id: 'l1',
        orderInSession: 0,
        status: 'pending',
        block: 'warmup',
        exerciseName: 'Movilidad articular',
        exerciseImageUrl: null,
        sets: null,
        reps: '5 min',
        deferCount: 0,
        notes: null,
      },
      {
        id: 'l2',
        orderInSession: 1,
        status: 'pending',
        block: 'exercise',
        exerciseName: 'Prensa',
        exerciseImageUrl: 'https://cdn.example.com/prensa.png',
        sets: 3,
        reps: '10',
        deferCount: 0,
        notes: null,
      },
    ],
    ...overrides,
  };
}

describe('TodaySessionCard', () => {
  it('loading', () => {
    useTodaySessionMock.mockReturnValue({ isLoading: true, data: undefined });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('empty state cuando no hay sesión', () => {
    useTodaySessionMock.mockReturnValue({ isLoading: false, data: null });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    expect(screen.getByText(/aún no hay sesión/i)).toBeInTheDocument();
  });

  it('muestra status greeted y conteo de items', () => {
    useTodaySessionMock.mockReturnValue({ isLoading: false, data: makeSession() });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    expect(screen.getByText(/esperando/i)).toBeInTheDocument();
    expect(screen.getByText('0/2 hechos')).toBeInTheDocument();
  });

  it('renderiza items con nombre de ejercicio', () => {
    useTodaySessionMock.mockReturnValue({ isLoading: false, data: makeSession() });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    expect(screen.getByText('Movilidad articular')).toBeInTheDocument();
    expect(screen.getByText('Prensa')).toBeInTheDocument();
  });

  it('renderiza img cuando exerciseImageUrl está presente', () => {
    useTodaySessionMock.mockReturnValue({ isLoading: false, data: makeSession() });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    const img = screen.getByAltText('Prensa') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('prensa.png');
  });

  it('marca el item actual presented con ring', () => {
    const session = makeSession({
      logs: [
        {
          id: 'l1',
          orderInSession: 0,
          status: 'presented',
          block: 'exercise',
          exerciseName: 'Sentadilla',
          exerciseImageUrl: null,
          sets: 3,
          reps: '10',
          deferCount: 0,
          notes: null,
        },
      ],
      itemsTotal: 1,
    });
    useTodaySessionMock.mockReturnValue({ isLoading: false, data: session });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    const row = screen.getByText('Sentadilla').closest('li');
    expect(row?.className).toContain('ring-primary');
  });

  it('muestra badge de defer cuando deferCount > 0', () => {
    const session = makeSession({
      logs: [
        {
          id: 'l1',
          orderInSession: 0,
          status: 'deferred',
          block: 'exercise',
          exerciseName: 'Prensa',
          exerciseImageUrl: null,
          sets: 3,
          reps: '10',
          deferCount: 2,
          notes: null,
        },
      ],
      itemsTotal: 1,
    });
    useTodaySessionMock.mockReturnValue({ isLoading: false, data: session });
    renderWithProviders(<TodaySessionCard clientId="c1" />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
