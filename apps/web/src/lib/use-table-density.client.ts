'use client';

import * as React from 'react';

/**
 * Hook de préférence « densité de tableau » (compact / normal), persistée.
 *
 * Patterné sur `useHighContrast` / `useTheme` : lecture/persistance via
 * `localStorage`, initialisation dans un `useEffect` (pas de lecture pendant le
 * rendu serveur → pas de mismatch d'hydratation). Défaut = `normal`.
 *
 * La valeur est passée en prop `density` à `<DataTable>` (opt-in) — aucun effet
 * global sur le document, contrairement au thème/contraste.
 */
export type TableDensity = 'normal' | 'compact';

const STORAGE_KEY = 'table-density';

export function useTableDensity(): {
  density: TableDensity;
  toggle: () => void;
} {
  const [density, setDensity] = React.useState<TableDensity>('normal');

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponible — pas de persistance. */
    }
    if (stored === 'compact' || stored === 'normal') {
      setDensity(stored);
    }
  }, []);

  const toggle = React.useCallback(() => {
    setDensity((prev) => {
      const next: TableDensity = prev === 'compact' ? 'normal' : 'compact';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* localStorage indisponible — préférence non persistée. */
      }
      return next;
    });
  }, []);

  return { density, toggle };
}
