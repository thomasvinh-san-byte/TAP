'use client';

import * as React from 'react';

/**
 * Hook bascule « police agrandie » chauffeur (PWA-04, §5.16).
 *
 * Patterné sur `useHighContrast` : lecture/persistance via
 * `localStorage['driver-font']` + attribut `data-driver-font="large"` sur
 * `<html>`. Le style associé (`font-size: 120%`) vit dans `globals.css`.
 *
 * Sûr côté mise en page : les tailles de texte sont en rem (échelle Tailwind
 * par défaut) et suivent donc la racine, alors que les espacements du design
 * system sont en px (échelle custom) et ne bougent pas — l'agrandissement
 * grossit le texte sans casser les écrans clés.
 */
const STORAGE_KEY = 'driver-font';

export function useDriverFontScale(): {
  enlarged: boolean;
  toggle: () => void;
} {
  const [enlarged, setEnlarged] = React.useState(false);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponible — pas de persistance. */
    }
    const initial = stored === 'large';
    if (initial) {
      document.documentElement.setAttribute('data-driver-font', 'large');
    }
    setEnlarged(initial);
  }, []);

  const toggle = React.useCallback(() => {
    setEnlarged((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.setAttribute('data-driver-font', 'large');
      } else {
        document.documentElement.removeAttribute('data-driver-font');
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'large' : 'normal');
      } catch {
        /* localStorage indisponible — préférence non persistée. */
      }
      return next;
    });
  }, []);

  return { enlarged, toggle };
}
