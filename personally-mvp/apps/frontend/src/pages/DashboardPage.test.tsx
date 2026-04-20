import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { DashboardTodayDto } from '@/features/dashboard/api';

const useDashboardTodayMock = vi.fn();
vi.mock('@/features/dashboard/hooks', () => ({
  useDashboardToday: () => useDashboardTodayMock(),
}));

const { DashboardPage } = await import('./DashboardPage');

function makeDashboard(overrides: Partial<DashboardTodayDto> = {}): DashboardTodayDto {
  return {
    summary: {
      totalClients: 3,
      sessionsCreated: 2,
      greeted: 1,
      inProgress: 1,
      completed: 0,
      partial: 0,
      missed: 0,
      noSession: 1,
      unreadNotifications: 2,
      failedMessages: 0,
    },
    clients: [
      {
        id: 'c1',
        name: 'Ana',
        phone: '+1',
        preferredStartTime: '06:00',
        session: {
          id: 's1',
          status: 'greeted',
          itemsTotal: 8,
          itemsDone: 0,
          itemsSkipped: 0,
          greetedAt: '2026-04-19T10:00:00Z',
          startedAt: null,
          finishedAt: null,
        },
      },
      {
        id: 'c2',
        name: 'Beto',
        phone: '+2',
        preferredStartTime: null,
        session: null,
      },
    ],
    ...overrides,
  };
}

describe('DashboardPage', () => {
  it('loading', () => {
    useDashboardTodayMock.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('error muestra mensaje', () => {
    useDashboardTodayMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      data: undefined,
    });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/error.*boom/i)).toBeInTheDocument();
  });

  it('renderiza stats + lista de clientes', () => {
    useDashboardTodayMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeDashboard(),
    });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Clientes activos')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('cliente sin sesión muestra "Sin sesión"', () => {
    useDashboardTodayMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeDashboard(),
    });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Sin sesión')).toBeInTheDocument();
  });

  it('muestra subtexto "N mensajes fallidos" cuando failedMessages > 0', () => {
    useDashboardTodayMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeDashboard({
        summary: {
          ...makeDashboard().summary,
          failedMessages: 3,
        },
      }),
    });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/3 mensajes fallidos/i)).toBeInTheDocument();
  });

  it('empty state cuando no hay clientes', () => {
    useDashboardTodayMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeDashboard({
        summary: { ...makeDashboard().summary, totalClients: 0 },
        clients: [],
      }),
    });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/no hay clientes activos/i)).toBeInTheDocument();
  });
});
