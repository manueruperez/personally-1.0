import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditableCell } from './EditableCell';

describe('EditableCell', () => {
  it('renderiza el valor como botón en modo read', () => {
    render(<EditableCell value={3} onCommit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /3/ })).toBeInTheDocument();
  });

  it('placeholder si value es null', () => {
    render(<EditableCell value={null} placeholder="—" onCommit={vi.fn()} />);
    expect(screen.getByRole('button', { name: '—' })).toBeInTheDocument();
  });

  it('click abre un input', async () => {
    const user = userEvent.setup();
    render(<EditableCell value={3} onCommit={vi.fn()} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('textbox')).toHaveValue('3');
  });

  it('Enter commitea con el valor nuevo', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<EditableCell value={3} fieldType="number" onCommit={onCommit} />);
    await user.click(screen.getByRole('button'));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '5');
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith(5);
  });

  it('Esc cancela y no llama onCommit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<EditableCell value="10" onCommit={onCommit} />);
    await user.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '99');
    await user.keyboard('{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('valor vacío commitea null', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<EditableCell value={7} fieldType="number" onCommit={onCommit} />);
    await user.click(screen.getByRole('button'));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('no commitea si el valor no cambió', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<EditableCell value="10" onCommit={onCommit} />);
    await user.click(screen.getByRole('button'));
    await user.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('disabled no abre input al click', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<EditableCell value={3} disabled onCommit={onCommit} />);
    await user.click(screen.getByRole('button'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renderiza suffix solo cuando hay valor', () => {
    const { rerender } = render(
      <EditableCell value={60} suffix="s" onCommit={vi.fn()} />,
    );
    expect(screen.getByRole('button').textContent).toMatch(/60.*s/);
    rerender(<EditableCell value={null} suffix="s" onCommit={vi.fn()} />);
    expect(screen.getByRole('button').textContent).not.toMatch(/s$/);
  });
});
