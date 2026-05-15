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
  const supabase = createClient();
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
  if (filters.paymentMethod)
    q = q.eq('payment_method', filters.paymentMethod);

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
