import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ThemeToggle } from './theme-toggle.client';

describe('<ThemeToggle>', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  it('démarre en mode jour si data-theme absent (aria-pressed=false)', () => {
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('nuit');
  });

  it('clic bascule vers dark : data-theme=dark, aria-pressed=true, label change', () => {
    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const button = getByRole('button');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toContain('jour');
  });

  it('persiste la préférence dans localStorage', () => {
    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole('button'));
    expect(window.localStorage.getItem('theme')).toBe('dark');
    fireEvent.click(getByRole('button'));
    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it("lit l'état initial depuis data-theme du document", () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { getByRole } = render(<ThemeToggle />);
    expect(getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
