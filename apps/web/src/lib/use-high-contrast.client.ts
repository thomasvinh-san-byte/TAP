'use client';

import * as React from 'react';

/**
 * Hook bascule mode contraste élevé (Phase 06.28, DEC-108 / DEC-014).
 *
 * Patterné sur `useTheme` (jour/nuit) : lecture/persistance via
 * `localStorage['driver-contrast']` + `data-driver-contrast="high"` sur
 * `<html>`. Le mode élevé renforce la lisibilité du chauffeur en
 * extérieur (plein soleil) — borders et texte muted plus tranchés via
 * overrides de CSS vars dans `globals.css`.
 *
 * Auto-activation : si l'OS signale `prefers-contrast: more` au premier
 * mount et qu'aucune préférence utilisateur n'a été stockée, le mode est
 * activé. L'utilisateur peut ensuite basculer manuellement.
 */
const STORAGE_KEY = 'driver-contrast';

export function useHighContrast(): {
  enabled: boolean;
  toggle: () => void;
} {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponible — pas de persistance. */
    }
    const prefersMore =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-contrast: more)').matches;
    const initial = stored === 'high' || (stored === null && prefersMore);
    if (initial) {
      document.documentElement.setAttribute('data-driver-contrast', 'high');
    }
    setEnabled(initial);
  }, []);

  const toggle = React.useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.setAttribute('data-driver-contrast', 'high');
      } else {
        document.documentElement.removeAttribute('data-driver-contrast');
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'high' : 'normal');
      } catch {
        /* localStorage indisponible — préférence non persistée. */
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
