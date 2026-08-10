'use client';

import * as React from 'react';

/**
 * Hook de préférence « lignes par page » (liste des courses), persistée.
 *
 * Même pattern que `useTableDensity` : lecture/persistance `localStorage`, init
 * dans un `useEffect` (pas de lecture au rendu serveur → pas de mismatch
 * d'hydratation). Défaut = 25 (plus compact que l'ancien 50). Valeur bornée aux
 * options autorisées.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const STORAGE_KEY = 'courses-page-size';

export function useTablePageSize(): {
  pageSize: number;
  setPageSize: (n: number) => void;
} {
  const [pageSize, setPageSizeState] = React.useState<number>(DEFAULT_PAGE_SIZE);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponible — pas de persistance. */
    }
    const n = stored ? Number(stored) : NaN;
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
      setPageSizeState(n);
    }
  }, []);

  const setPageSize = React.useCallback((n: number) => {
    const next = (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
    setPageSizeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* localStorage indisponible — préférence non persistée. */
    }
  }, []);

  return { pageSize, setPageSize };
}
