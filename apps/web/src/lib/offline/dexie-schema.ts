/**
 * Dexie 4.x schema PWA chauffeur Phase 04.9 (Wave 3).
 *
 * 3 tables :
 *   - mutations_queue : file d'attente mutations offline
 *     (start_ride/end_ride) en attente de sync au retour réseau
 *   - rides_mirror : cache opportuniste courses du jour
 *     (read-only offline pour la journée chauffeur)
 *   - app_meta : metadata clé/valeur (lastUsedAt DEC-022 etc.)
 *
 * Refs : PLAN-3, DEC-019 LOCKED Serwist+Dexie 4.x, DEC-022.
 */

import Dexie, { type Table } from 'dexie';

// PWA-01 (§5.16) : transitions intermédiaires de la prise en charge. Mêmes
// table/index Dexie (le type n'est qu'un champ texte) — pas de bump de version.
export type MutationType =
  | 'start_ride'
  | 'arrive_ride'
  | 'board_ride'
  | 'end_ride'
  | 'no_show_ride'
  // PWA-04 (§5.16) : relevé kilométrique journalier (endpoint non lié à une
  // course). Même table/index Dexie (le type est un champ texte) — pas de bump.
  | 'save_mileage';
export type MutationStatus = 'pending' | 'in_flight' | 'failed' | 'dead';

export interface PendingMutation {
  id?: number;
  type: MutationType;
  resource_id: string;
  payload: unknown;
  idempotency_key: string;
  status: MutationStatus;
  attempts: number;
  created_at: Date;
  last_attempt_at: Date | null;
  last_error: string | null;
}

export interface RideMirror {
  id: string;
  status: string;
  pickup_address: string;
  pickup_at: string;
  patient_id: string | null;
  synced_at: Date;
}

export interface AppMeta {
  key: string;
  value: string | number | boolean;
}

export class DriverOfflineDb extends Dexie {
  mutations_queue!: Table<PendingMutation, number>;
  rides_mirror!: Table<RideMirror, string>;
  app_meta!: Table<AppMeta, string>;

  constructor() {
    super('tap-driver-offline');
    this.version(1).stores({
      mutations_queue: '++id, status, type, resource_id, created_at',
      rides_mirror: 'id, status, pickup_at, synced_at',
      app_meta: 'key',
    });
  }
}
