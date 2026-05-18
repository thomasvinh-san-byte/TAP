'use client';

/**
 * Hook `useIsStandalone` — Phase 04.9 Wave 5.
 *
 * Detection PWA installée (mode standalone) sur Android et iOS :
 *   - Android Chrome / Edge / Samsung Internet : `window.matchMedia('(display-mode: standalone)')`
 *   - iOS Safari : `window.navigator.standalone` (non-standard mais
 *     toujours supporté Safari iOS, cf firt.dev research PR #110)
 *
 * Utilisé pour adapter l'UI selon le contexte d'utilisation (PWA
 * installée vs browser tab).
 *
 * Refs : PLAN-5, recherche industrie 2026 (firt.dev iOS PWA), Option A.
 */

import { useEffect, useState } from 'react';

export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const android = window.matchMedia('(display-mode: standalone)').matches;
    const ios =
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
    setIsStandalone(android || ios);
  }, []);

  return isStandalone;
}
