import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { PasswordInput } from './password-input.client';

describe('<PasswordInput>', () => {
  it('démarre masqué (type="password")', () => {
    const { container } = render(<PasswordInput aria-label="password" />);
    expect(container.querySelector('input')?.getAttribute('type')).toBe('password');
  });

  it('toggle bascule type vers text au clic', () => {
    const { container, getByRole } = render(<PasswordInput aria-label="password" />);
    const button = getByRole('button', { name: /Afficher/i });
    fireEvent.click(button);
    expect(container.querySelector('input')?.getAttribute('type')).toBe('text');
  });

  it("aria-pressed reflète l'état (false par défaut, true après toggle)", () => {
    const { getByRole } = render(<PasswordInput aria-label="password" />);
    let button = getByRole('button', { name: /Afficher/i });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    button = getByRole('button', { name: /Masquer/i });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it("aria-label change avec l'état", () => {
    const { getByRole, queryByRole } = render(<PasswordInput aria-label="password" />);
    expect(getByRole('button', { name: 'Afficher le mot de passe' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Masquer le mot de passe' })).toBeNull();
  });

  it('propage les autres attributs (autoComplete, required, defaultValue)', () => {
    const { container } = render(
      <PasswordInput
        aria-label="password"
        autoComplete="current-password"
        required
        defaultValue="hello"
      />,
    );
    const input = container.querySelector('input');
    expect(input?.getAttribute('autocomplete')).toBe('current-password');
    expect(input?.required).toBe(true);
    expect((input as HTMLInputElement).defaultValue).toBe('hello');
  });
});
