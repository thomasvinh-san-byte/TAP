/**
 * Store Dexie de CONSULTATION hors-ligne du régulateur (DEC-177, CdG §5.24).
 *
 * Base SÉPARÉE du store chauffeur (`tap-driver-offline`) → zéro régression sur
 * le mode chauffeur. Différence FONDAMENTALE : ici LECTURE SEULE — pas de file
 * de mutations, pas de sync d'écriture. Juste un miroir du planning J / J+1 mis
 * à jour quand la régulatrice est EN LIGNE, consultable hors-ligne tant qu'il
 * est FRAIS (péremption 4h, exigence de sécurité métier).
 *
 * RGPD : contient des contacts patient (téléphones) → cache LOCAL navigateur,
 * vidé à la déconnexion (`clearRegulateurMirror`) et masqué au-delà de 4h.
 */

import Dexie, { type Table } from 'dexie';

/** Fraîcheur maximale d'un planning hors-ligne (CdG §5.24 : 4 heures). */
export const PLANNING_MAX_AGE_MS = 4 * 60 * 60 * 1000;

const SYNCED_AT_KEY = 'planning_synced_at';

export interface PlanningMirrorRow {
  id: string;
  scheduled_at: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  patient_label: string;
  patient_phone: string | null;
  driver_label: string | null;
  driver_phone: string | null;
}

interface RegulateurMeta {
  key: string;
  value: number;
}

class RegulateurOfflineDb extends Dexie {
  planning_mirror!: Table<PlanningMirrorRow, string>;
  meta!: Table<RegulateurMeta, string>;

  constructor() {
    super('tap-regulateur-offline');
    this.version(1).stores({
      planning_mirror: 'id, scheduled_at, status',
      meta: 'key',
    });
  }
}

let dbInstance: RegulateurOfflineDb | null = null;

function getDb(): RegulateurOfflineDb {
  if (typeof window === 'undefined') {
    throw new Error('RegulateurOfflineDb accessed during SSR — wrap call in useEffect.');
  }
  if (!dbInstance) dbInstance = new RegulateurOfflineDb();
  return dbInstance;
}

/** Remplace intégralement le miroir + horodate la synchro (courses retirées purgées). */
export async function saveRegulateurMirror(rows: PlanningMirrorRow[]): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.planning_mirror, db.meta, async () => {
    await db.planning_mirror.clear();
    if (rows.length > 0) await db.planning_mirror.bulkPut(rows);
    await db.meta.put({ key: SYNCED_AT_KEY, value: Date.now() });
  });
}

/** Lecture du miroir, triée par horaire. */
export function readRegulateurMirror(): Promise<PlanningMirrorRow[]> {
  return getDb().planning_mirror.orderBy('scheduled_at').toArray();
}

/** Horodatage (epoch ms) de la dernière synchro, ou null. */
export async function getRegulateurSyncedAt(): Promise<number | null> {
  const row = await getDb().meta.get(SYNCED_AT_KEY);
  return row?.value ?? null;
}

/** Vide le miroir + l'horodatage (déconnexion RGPD). Best-effort. */
export async function clearRegulateurMirror(): Promise<void> {
  try {
    const db = getDb();
    await db.transaction('rw', db.planning_mirror, db.meta, async () => {
      await db.planning_mirror.clear();
      await db.meta.clear();
    });
  } catch {
    // best-effort : pas de blocage de la déconnexion.
  }
}

/** Vrai si le miroir est trop ancien pour être affiché (> 4h). */
export function isPlanningStale(syncedAt: number | null, now: number = Date.now()): boolean {
  if (syncedAt === null) return true;
  return now - syncedAt > PLANNING_MAX_AGE_MS;
}

export { getDb as getRegulateurDb };
