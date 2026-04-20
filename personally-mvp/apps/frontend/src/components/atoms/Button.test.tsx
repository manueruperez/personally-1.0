import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renderiza el texto', () => {
    render(<Button>Enviar</Button>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('respeta disabled', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('dispara onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('variant destructive aplica estilos destructive', () => {
    render(<Button variant="destructive">Borrar</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/destructive/);
  });

  it('size sm aplica estilo small', () => {
    render(<Button size="sm">Sm</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/h-9/);
  });
});
