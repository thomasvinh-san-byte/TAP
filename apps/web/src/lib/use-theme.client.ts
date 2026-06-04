'use client';

import * as React from 'react';

/**
 * Hook partagé pour la bascule de thème jour/nuit (Phase 06.18).
 *
 * Source unique de la logique : lecture de l'attribut `data-theme` sur
 * `<html>` (posé par le script anti-FOUC de `app/layout.tsx`), bascule
 * et persistance localStorage `theme`. Consommé par `<ThemeToggle>`
 * (bouton standalone AuthShell) et `<UserMenu>` (entrée DropdownMenu).
 *
 * Évite la duplication de la mécanique entre les deux UIs (même état,
 * deux rendus distincts).
 */
export function useTheme(): {
  theme: 'light' | 'dark';
  toggle: () => void;
} {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      try {
        window.localStorage.setItem('theme', next);
      } catch {
        /* localStorage indisponible — préférence non persistée. */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
