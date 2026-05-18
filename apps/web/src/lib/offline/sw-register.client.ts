'use client';

/**
 * Hook register service worker PWA chauffeur Phase 04.9 (Wave 3).
 *
 * Au mount :
 *   1. Register /sw.js (Serwist auto-généré via withSerwistInit)
 *   2. Appel navigator.storage.persist() — DEC-022 mitigation iOS
 *      purge IndexedDB ~2 semaines inactivité
 *   3. Update app_meta.lastUsedAt — consommé Wave 5
 *      WarningBannerInactivity > 7j
 *
 * Le hook est idempotent : re-register du même SW retourne la même
 * registration. Errors sont catch silencieusement (warn console
 * seulement) pour ne pas casser l'UI si IndexedDB rejette.
 *
 * Refs : PLAN-3, DEC-019, DEC-022 LOCKED.
 */

import { useEffect } from 'react';
import { getDb } from './dexie-instance';

const LAST_USED_KEY = 'lastUsedAt';

export function useServiceWorkerRegister(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[PWA] Service worker registration failed:', error);
      });
    }

    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage
        .persist()
        .then((persisted) => {
          console.info('[PWA] Storage persisted:', persisted);
        })
        .catch((error) => {
          console.warn('[PWA] Storage persist request failed:', error);
        });
    }

    try {
      const db = getDb();
      db.app_meta
        .put({ key: LAST_USED_KEY, value: Date.now() })
        .catch((error) => {
          console.warn('[PWA] Failed to update lastUsedAt:', error);
        });
    } catch (error) {
      console.warn('[PWA] Dexie instance unavailable:', error);
    }
  }, []);
}
