import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { MessageDto } from '@/features/messages/api';

// Mock del hook para devolver data controlada
const useClientMessagesMock = vi.fn();
vi.mock('@/features/messages/hooks', () => ({
  useClientMessages: (clientId: string) => useClientMessagesMock(clientId),
}));

const { ClientConversation } = await import('./ClientConversation');

function makeMessage(overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id: 'm1',
    clientId: 'c1',
    sessionId: null,
    direction: 'inbound',
    channel: 'whatsapp',
    externalId: 'ext-1',
    sentAt: '2026-04-19T10:00:00Z',
    receivedAt: '2026-04-19T10:00:00Z',
    contentType: 'text',
    contentText: 'hola',
    mediaUrl: null,
    intentDetected: null,
    intentConfidence: null,
    triggeredAction: null,
    templateKey: null,
    isTemplateBased: null,
    agentVersion: null,
    error: null,
    ...overrides,
  };
}

describe('ClientConversation', () => {
  it('loading state', () => {
    useClientMessagesMock.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    renderWithProviders(<ClientConversation clientId="c1" />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('empty state cuando data es array vacio', () => {
    useClientMessagesMock.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderWithProviders(<ClientConversation clientId="c1" />);
    expect(screen.getByText(/todavía no hay mensajes/i)).toBeInTheDocument();
  });

  it('renderiza burbujas ordenadas por sentAt ASC', () => {
    const msgs = [
      makeMessage({ id: '2', contentText: 'segunda', sentAt: '2026-04-19T10:05:00Z' }),
      makeMessage({ id: '1', contentText: 'primera', sentAt: '2026-04-19T10:00:00Z' }),
    ];
    useClientMessagesMock.mockReturnValue({ isLoading: false, isError: false, data: msgs });
    renderWithProviders(<ClientConversation clientId="c1" />);

    const bubbles = screen.getAllByText(/primera|segunda/);
    expect(bubbles[0]).toHaveTextContent('primera');
    expect(bubbles[1]).toHaveTextContent('segunda');
  });

  it('outbound aplica estilos distintos a inbound', () => {
    const msgs = [
      makeMessage({ id: '1', direction: 'inbound', contentText: 'del cliente' }),
      makeMessage({ id: '2', direction: 'outbound', contentText: 'del bot' }),
    ];
    useClientMessagesMock.mockReturnValue({ isLoading: false, isError: false, data: msgs });
    renderWithProviders(<ClientConversation clientId="c1" />);

    const inbound = screen.getByText('del cliente');
    const outbound = screen.getByText('del bot');
    expect(inbound.className).toMatch(/bg-muted/);
    expect(outbound.className).toMatch(/bg-primary/);
  });

  it('muestra badge de intent detectado en inbound', () => {
    useClientMessagesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        makeMessage({
          direction: 'inbound',
          contentText: 'siguiente',
          intentDetected: 'NEXT',
        }),
      ],
    });
    renderWithProviders(<ClientConversation clientId="c1" />);
    expect(screen.getByText('NEXT')).toBeInTheDocument();
  });

  it('muestra templateKey en outbound', () => {
    useClientMessagesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        makeMessage({
          direction: 'outbound',
          contentText: 'Hola Juan!',
          templateKey: 'greeting',
        }),
      ],
    });
    renderWithProviders(<ClientConversation clientId="c1" />);
    expect(screen.getByText('greeting')).toBeInTheDocument();
  });

  it('mensaje con error muestra indicador', () => {
    useClientMessagesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        makeMessage({
          direction: 'outbound',
          contentText: 'fallo',
          error: 'Detached frame',
        }),
      ],
    });
    renderWithProviders(<ClientConversation clientId="c1" />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
