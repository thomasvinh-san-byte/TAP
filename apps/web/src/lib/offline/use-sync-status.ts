'use client';

/**
 * Hook React `useSyncStatus` — Phase 04.9 Wave 4.
 *
 * Combine `navigator.onLine` + listeners online/offline + `useLiveQuery`
 * Dexie réactif sur `mutations_queue` counts.
 *
 * Consommé par `ConnectionStatusBadge` Wave 5 pour rendre les 4 états
 * (`online_idle`, `synching`, `offline_with_queue`, `offline_idle`).
 *
 * Refs : PLAN-4, dexie-react-hooks `useLiveQuery`.
 */

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from './dexie-instance';

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  deadCount: number;
  isSynching: boolean;
}

export function useSyncStatus(): SyncStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const pendingCount = useLiveQuery(
    () => {
      if (typeof window === 'undefined') return 0;
      return getDb()
        .mutations_queue.where('status')
        .anyOf('pending', 'in_flight', 'failed')
        .count();
    },
    [],
    0,
  );

  const deadCount = useLiveQuery(
    () => {
      if (typeof window === 'undefined') return 0;
      return getDb().mutations_queue.where('status').equals('dead').count();
    },
    [],
    0,
  );

  return {
    isOnline,
    pendingCount: pendingCount ?? 0,
    deadCount: deadCount ?? 0,
    isSynching: isOnline && (pendingCount ?? 0) > 0,
  };
}
