'use client';

/**
 * Hook `useNetworkListener` — Phase 04.9 Wave 4.
 *
 * Attache `window.addEventListener('online', flushQueue)` au mount.
 * Pattern fallback Background Sync API non supporté iOS Safari.
 *
 * Premier flush au mount si déjà online (cas reload PWA après période
 * offline avec queue restée pleine).
 *
 * Refs : PLAN-4, magicbell PWA iOS limitations (research PR #110).
 */

import { useEffect } from 'react';
import { flushQueue } from './sync-engine';

export function useNetworkListener(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      void flushQueue();
    };

    window.addEventListener('online', handler);

    if (navigator.onLine) {
      void flushQueue();
    }

    return () => window.removeEventListener('online', handler);
  }, []);
}
