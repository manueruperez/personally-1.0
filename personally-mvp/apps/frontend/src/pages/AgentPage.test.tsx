import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { AgentState, AgentStatusDto } from '@/features/agent/api';

const useAgentStatusMock = vi.fn();
vi.mock('@/features/agent/hooks', () => ({
  useAgentStatus: () => useAgentStatusMock(),
}));

const { AgentPage } = await import('./AgentPage');

function makeStatus(state: AgentState): AgentStatusDto {
  return {
    trainerId: '11111111-1111-1111-1111-111111111111',
    state,
    uptimeSec: 3661,
    lastHeartbeatAt: new Date().toISOString(),
    agentVersion: '1.0.0',
  };
}

function render(state: AgentState) {
  useAgentStatusMock.mockReturnValue({ isLoading: false, data: makeStatus(state) });
  renderWithProviders(<AgentPage />);
}

describe('AgentPage', () => {
  it('loading', () => {
    useAgentStatusMock.mockReturnValue({ isLoading: true, data: undefined });
    renderWithProviders(<AgentPage />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('en linea muestra el uptime y ninguna alarma', () => {
    render('online');
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText(/funcionando hace 1h 1m/i)).toBeInTheDocument();
    expect(screen.queryByText(/no está enviando mensajes/i)).not.toBeInTheDocument();
  });

  it('caido explica que los mensajes quedan en cola', () => {
    render('offline');
    expect(screen.getByText('Caído')).toBeInTheDocument();
    expect(screen.getByText(/no está enviando mensajes/i)).toBeInTheDocument();
    expect(screen.getByText(/quedan en cola/i)).toBeInTheDocument();
  });

  it('sin datos se trata igual que caido: el bot no esta mandando nada', () => {
    render('unknown');
    expect(screen.getByText(/todavía no dio señales de vida/i)).toBeInTheDocument();
    expect(screen.getByText(/no está enviando mensajes/i)).toBeInTheDocument();
  });

  it('no ofrece ningun boton: no hay accion del trainer que levante el bot', () => {
    render('offline');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('no menciona QR, Puppeteer ni comandos de terminal', () => {
    render('offline');
    expect(document.body.textContent).not.toMatch(/qr|puppeteer|pnpm|supervis/i);
  });
});
