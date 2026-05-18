/**
 * Singleton Dexie instance pour PWA chauffeur Phase 04.9.
 *
 * Pattern singleton garantit qu'une seule instance Dexie est partagée
 * entre tous les composants client (sync engine Wave 4, useLiveQuery
 * hooks Wave 5).
 *
 * SSR-safe : throw si appelé côté serveur (IndexedDB n'existe pas).
 * Toujours wrapper en `useEffect` ou check `typeof window`.
 *
 * Refs : PLAN-3, DEC-019.
 */

import { DriverOfflineDb } from './dexie-schema';

let dbInstance: DriverOfflineDb | null = null;

export function getDb(): DriverOfflineDb {
  if (typeof window === 'undefined') {
    throw new Error(
      'Dexie database accessed during SSR — wrap call in useEffect or check typeof window',
    );
  }
  if (!dbInstance) {
    dbInstance = new DriverOfflineDb();
  }
  return dbInstance;
}

export type { DriverOfflineDb };
