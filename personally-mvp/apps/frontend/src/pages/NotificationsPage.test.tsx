import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { NotificationDto } from '@/features/notifications/api';

const useNotificationsMock = vi.fn();
const markReadMock = vi.fn();
const replyMock = vi.fn();

vi.mock('@/features/notifications/hooks', () => ({
  useNotifications: (unreadOnly: boolean) => useNotificationsMock(unreadOnly),
  useMarkNotificationRead: () => ({ mutate: markReadMock, isPending: false }),
  useReplyNotification: () => ({
    mutate: replyMock,
    mutateAsync: replyMock,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/features/agent/hooks', () => ({
  useAgentStatus: () => ({ data: { state: 'online' } }),
}));

const { NotificationsPage } = await import('./NotificationsPage');

function makeNotif(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1',
    organizationId: 'o1',
    trainerId: 't1',
    type: 'pain_report',
    title: 'Juan reporta dolor',
    body: 'me duele la rodilla',
    metadata: { clientId: 'c1', exerciseName: 'Prensa' },
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationsPage', () => {
  it('renderiza lista de notificaciones', () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [makeNotif()],
    });
    renderWithProviders(<NotificationsPage />);
    expect(screen.getByText('Juan reporta dolor')).toBeInTheDocument();
    expect(screen.getByText(/me duele la rodilla/)).toBeInTheDocument();
  });

  it('empty state cuando no hay sin leer', () => {
    useNotificationsMock.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderWithProviders(<NotificationsPage />);
    expect(screen.getByText(/no hay notificaciones sin leer/i)).toBeInTheDocument();
  });

  it('click "Descartar" llama markRead', async () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [makeNotif()],
    });
    renderWithProviders(<NotificationsPage />);
    const btn = screen.getByRole('button', { name: /descartar/i });
    await userEvent.setup().click(btn);
    expect(markReadMock).toHaveBeenCalledWith('n1');
  });

  it('abre textarea al clickear Responder', async () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [makeNotif()],
    });
    renderWithProviders(<NotificationsPage />);
    const btn = screen.getByRole('button', { name: /responder/i });
    await userEvent.setup().click(btn);
    expect(
      screen.getByPlaceholderText(/mensaje para el cliente/i),
    ).toBeInTheDocument();
  });

  it('envía reply con el texto escrito', async () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [makeNotif()],
    });
    renderWithProviders(<NotificationsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /responder/i }));
    const textarea = screen.getByPlaceholderText(/mensaje para el cliente/i);
    await user.type(textarea, 'Probá sentadilla hack');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));
    expect(replyMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', text: 'Probá sentadilla hack' }),
    );
  });

  it('muestra nombre del ejercicio si viene en metadata', () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [makeNotif()],
    });
    renderWithProviders(<NotificationsPage />);
    expect(screen.getByText('Prensa')).toBeInTheDocument();
  });
});
