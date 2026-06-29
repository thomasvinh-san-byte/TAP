import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Queries serveur pour la page /courses/caisse (Phase 04.7 PLAN-2).
 *
 * Pas de `'use server'` — appelé directement par Server Components
 * (pattern miroir `_lib/queries.ts` Phase 03). RLS Postgres scope
 * automatiquement par organization_id via `current_organization_id()`.
 *
 * Filtres serveur (date, driver, payment_method) pour ne pas charger
 * inutilement. Tri serveur par colonne. Pas de pagination V1.5
 * (volume attendu ≤ 50 rides/jour, à monitorer Phase 04.9).
 *
 * Refs : DEC-043 LOCKED, UI-SPEC Surface C.
 */

export type CaissePaymentMethod = 'cash' | 'cb' | 'cheque' | 'cgss_differe';
export type CaisseSortColumn = 'date' | 'tarif';
export type CaisseSortDir = 'asc' | 'desc';

export interface CaisseFilters {
  date: string; // YYYY-MM-DD
  driverId?: string;
  paymentMethod?: CaissePaymentMethod;
  sort?: CaisseSortColumn;
  dir?: CaisseSortDir;
}

export interface CaisseRow {
  id: string;
  scheduled_at: string;
  ended_at: string | null;
  tarif_amount_eur: number | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_received_at: string | null;
  patient_nom: string;
  patient_prenom: string;
  driver_nom: string;
}

export interface CaisseTotals {
  total_eur: number;
  count: number;
  by_method: Record<string, number>;
}

interface RawRow {
  id: string;
  scheduled_at: string;
  ended_at: string | null;
  tarif_amount_eur: number | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_received_at: string | null;
  patient: { nom: string; prenom: string } | null;
  driver: { nom_affichage: string } | null;
}

export async function listRidesEncaissees(
  filters: CaisseFilters,
): Promise<{ rows: CaisseRow[]; totals: CaisseTotals }> {
  const supabase = await createClient();
  const dateStart = new Date(`${filters.date}T00:00:00.000Z`).toISOString();
  const dateEnd = new Date(`${filters.date}T23:59:59.999Z`).toISOString();

  let q = supabase
    .from('rides')
    .select(
      `id, scheduled_at, ended_at,
       tarif_amount_eur, payment_method, payment_status, payment_received_at,
       patient:patients!inner(nom, prenom),
       driver:drivers(nom_affichage)`,
    )
    .eq('status', 'terminee')
    .eq('payment_status', 'encaisse')
    .gte('ended_at', dateStart)
    .lte('ended_at', dateEnd);

  if (filters.driverId) q = q.eq('driver_id', filters.driverId);
  if (filters.paymentMethod) q = q.eq('payment_method', filters.paymentMethod);

  const sortCol = filters.sort === 'tarif' ? 'tarif_amount_eur' : 'ended_at';
  const ascending = filters.dir === 'asc';
  q = q.order(sortCol, { ascending });

  const res = await q;
  if (res.error || !res.data) {
    return { rows: [], totals: { total_eur: 0, count: 0, by_method: {} } };
  }

  const rows: CaisseRow[] = (res.data as unknown as RawRow[]).map((r) => ({
    id: r.id,
    scheduled_at: r.scheduled_at,
    ended_at: r.ended_at,
    tarif_amount_eur: r.tarif_amount_eur,
    payment_method: r.payment_method,
    payment_status: r.payment_status,
    payment_received_at: r.payment_received_at,
    patient_nom: r.patient?.nom ?? '',
    patient_prenom: r.patient?.prenom ?? '',
    driver_nom: r.driver?.nom_affichage ?? '',
  }));

  const totals = rows.reduce<CaisseTotals>(
    (acc, r) => {
      const amount = Number(r.tarif_amount_eur ?? 0);
      acc.total_eur += amount;
      acc.count += 1;
      const m = r.payment_method ?? 'inconnu';
      acc.by_method[m] = (acc.by_method[m] ?? 0) + amount;
      return acc;
    },
    { total_eur: 0, count: 0, by_method: {} },
  );

  return { rows, totals };
}

// CAISSE-01 : l'encours « à encaisser » est un STOCK (créances en attente), pas
// le journal d'un jour. Borné à 12 mois (`ended_at`), cohérent avec le KPI
// encours du tableau de bord (KPI-02) — au-delà, c'est un traitement comptable.
const AENCAISSER_WINDOW_DAYS = 365;

export interface AEncaisserFilters {
  driverId?: string;
}

export interface AEncaisserResult {
  rows: CaisseRow[];
  total_eur: number;
  count: number;
}

/**
 * Courses RESTANT à encaisser (CAISSE-01) — `status='terminee'` ET
 * `payment_status='a_encaisser'`. Stock cumulé (fenêtre 12 mois), trié par
 * ancienneté croissante (`ended_at` asc — les plus vieilles créances d'abord,
 * les plus à risque). Pas de ventilation par mode (la course n'a pas encore de
 * mode de paiement). Mêmes jointures patient/chauffeur que `listRidesEncaissees`.
 */
export async function listRidesAEncaisser(filters: AEncaisserFilters): Promise<AEncaisserResult> {
  const supabase = await createClient();
  const since = new Date(Date.now() - AENCAISSER_WINDOW_DAYS * 86_400_000).toISOString();

  let q = supabase
    .from('rides')
    .select(
      `id, scheduled_at, ended_at,
       tarif_amount_eur, payment_method, payment_status, payment_received_at,
       patient:patients!inner(nom, prenom),
       driver:drivers(nom_affichage)`,
    )
    .eq('status', 'terminee')
    .eq('payment_status', 'a_encaisser')
    .gte('ended_at', since)
    .order('ended_at', { ascending: true });

  if (filters.driverId) q = q.eq('driver_id', filters.driverId);

  const res = await q;
  if (res.error || !res.data) return { rows: [], total_eur: 0, count: 0 };

  const rows: CaisseRow[] = (res.data as unknown as RawRow[]).map((r) => ({
    id: r.id,
    scheduled_at: r.scheduled_at,
    ended_at: r.ended_at,
    tarif_amount_eur: r.tarif_amount_eur,
    payment_method: r.payment_method,
    payment_status: r.payment_status,
    payment_received_at: r.payment_received_at,
    patient_nom: r.patient?.nom ?? '',
    patient_prenom: r.patient?.prenom ?? '',
    driver_nom: r.driver?.nom_affichage ?? '',
  }));

  const total_eur = rows.reduce((acc, r) => acc + Number(r.tarif_amount_eur ?? 0), 0);
  return { rows, total_eur, count: rows.length };
}

/** Modes de paiement agrégés dans le rapport de caisse (CAISSE-02). */
export const CAISSE_REPORT_METHODS = ['cash', 'cb', 'cheque', 'cgss_differe'] as const;

export interface CaisseDriverReportRow {
  driver_id: string;
  driver_nom: string;
  count: number;
  total_eur: number;
  /** Ventilation par mode (clés de CAISSE_REPORT_METHODS). */
  by_method: Record<string, number>;
}

export interface CaisseDriverReport {
  rows: CaisseDriverReportRow[];
  total: { count: number; total_eur: number; by_method: Record<string, number> };
}

interface ReportRawRow {
  tarif_amount_eur: number | null;
  payment_method: string | null;
  driver_id: string | null;
  driver: { nom_affichage: string } | null;
}

/**
 * Rapport de caisse agrégé PAR CHAUFFEUR sur une période (CdG §5.19, CAISSE-02).
 * Courses `status='terminee'` + `payment_status='encaisse'`, bornes `ended_at` ∈
 * [from, to] (jours inclus). Pour chaque chauffeur : total encaissé, nombre de
 * courses, ventilation par mode (cash/cb/cheque/cgss_differe). + un total général
 * (somme de toutes les lignes). Filtre optionnel `driverId` (rapport mono-chauffeur).
 *
 * Une course encaissée SANS `driver_id` est regroupée sous « — » (jamais perdue).
 * Perf : même posture d'index que `listRidesEncaissees` (filtre status +
 * payment_status + ended_at) ; plage bornée à 12 mois côté action.
 */
export async function getCaisseReportByDriver(
  from: string,
  to: string,
  driverId?: string,
): Promise<CaisseDriverReport> {
  const supabase = await createClient();
  const start = new Date(`${from}T00:00:00.000Z`).toISOString();
  const end = new Date(`${to}T23:59:59.999Z`).toISOString();

  let q = supabase
    .from('rides')
    .select(
      `tarif_amount_eur, payment_method, driver_id,
       driver:drivers(nom_affichage)`,
    )
    .eq('status', 'terminee')
    .eq('payment_status', 'encaisse')
    .gte('ended_at', start)
    .lte('ended_at', end);
  if (driverId) q = q.eq('driver_id', driverId);

  const emptyTotal = { count: 0, total_eur: 0, by_method: {} as Record<string, number> };
  const res = await q;
  if (res.error || !res.data) return { rows: [], total: emptyTotal };

  const byDriver = new Map<string, CaisseDriverReportRow>();
  const total = { count: 0, total_eur: 0, by_method: {} as Record<string, number> };

  for (const r of res.data as unknown as ReportRawRow[]) {
    const key = r.driver_id ?? '—';
    const amount = Number(r.tarif_amount_eur ?? 0);
    const method = r.payment_method ?? 'inconnu';
    const acc =
      byDriver.get(key) ??
      ({
        driver_id: key,
        driver_nom: r.driver?.nom_affichage ?? '—',
        count: 0,
        total_eur: 0,
        by_method: {},
      } satisfies CaisseDriverReportRow);
    acc.count += 1;
    acc.total_eur += amount;
    acc.by_method[method] = (acc.by_method[method] ?? 0) + amount;
    byDriver.set(key, acc);

    total.count += 1;
    total.total_eur += amount;
    total.by_method[method] = (total.by_method[method] ?? 0) + amount;
  }

  const rows = [...byDriver.values()].sort((a, b) =>
    a.driver_nom.localeCompare(b.driver_nom, 'fr'),
  );
  return { rows, total };
}
