import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PrivacyPage } from './PrivacyPage';

/**
 * La revisa un bot de Meta sin sesion iniciada: si la pagina dependiera de auth
 * o de datos remotos, la publicacion de la app se cae y con ella los webhooks.
 */
describe('PrivacyPage', () => {
  it('renderiza sin sesion ni datos remotos', () => {
    renderWithProviders(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: /política de privacidad/i })).toBeVisible();
  });

  it('cubre las secciones que Meta espera en una politica', () => {
    renderWithProviders(<PrivacyPage />);

    for (const titulo of [
      /qué datos tratamos/i,
      /para qué los usamos/i,
      /con quién los compartimos/i,
      /cuánto tiempo los conservamos/i,
      /tus derechos/i,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeVisible();
    }
  });

  it('publica un contacto para ejercer derechos sobre los datos', () => {
    renderWithProviders(<PrivacyPage />);

    const mails = screen.getAllByRole('link', { name: /hola@personallay\.com/i });

    expect(mails.length).toBeGreaterThan(0);
    expect(mails[0]).toHaveAttribute('href', 'mailto:hola@personallay.com');
  });

  it('explica como frenar los mensajes del bot', () => {
    renderWithProviders(<PrivacyPage />);

    expect(screen.getByText(/BAJA/)).toBeVisible();
  });
});
