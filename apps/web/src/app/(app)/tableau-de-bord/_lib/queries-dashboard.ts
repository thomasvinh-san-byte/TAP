import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  getCoursesFacturables,
  getCountCoursesSansTarif,
  monthBounds,
} from '@/app/(admin)/admin/facturation/_lib/queries-facturation';
import type { CaisseTotals } from '@/app/(app)/courses/caisse/_lib/queries-caisse';

/**
 * Agrégations du tableau de bord dirigeant (Phase 06.8).
 *
 * `import 'server-only'` — appelé par le Server Component de la page. RLS
 * Postgres scope par `organization_id`.
 *
 * Cohérence des chiffres (D-04) : les KPIs monétaires réutilisent les helpers
 * et définitions de Caisse / Facturation — `getCoursesFacturables`,
 * `getCountCoursesSansTarif`, `monthBounds`, et la définition « encaissé » de
 * `listRidesEncaissees` (mêmes critères `status='terminee'` +
 * `payment_status='encaisse'` + ventilation `by_method`). Aucune requête
 * monétaire n'est réécrite. Les comptes de statut n'ont pas de contrepartie
 * Caisse/Facturation — ce sont des comptes directs sur `rides` / `drivers`.
 */

const STATUTS_ANNULEE = ['annulee_regulateur', 'annulee_patient', 'annulee_chauffeur'];

export interface DashboardVolume {
  aujourdhui: number;
  semaine: number;
  mois: number;
}

export interface DashboardIncidents {
  taux: number; // pourcentage entier 0-100
  noShow: number;
  annulations: number;
  total: number;
}

export interface DashboardChauffeurs {
  actifsAvecCourse: number;
  totalActifs: number;
  moyenneParChauffeur: number;
}

export interface DashboardConformite {
  registreCount: number;
  dpaCount: number;
  dpiaStatut: string; // 'brouillon' | 'validee' | 'archivee' | 'aucune'
  derniereMaj: string | null;
}

export interface DashboardData {
  coursesAFacturer: number;
  facturesIncompletes: number;
  noShowsRecents: number;
  caMois: CaisseTotals;
  volume: DashboardVolume;
  incidents: DashboardIncidents;
  chauffeurs: DashboardChauffeurs;
  conformite: DashboardConformite;
}

type Supabase = ReturnType<typeof createClient>;

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function utcDayBounds(): { start: string; end: string } {
  const d = new Date();
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { start: new Date(start).toISOString(), end: new Date(start + 86_400_000).toISOString() };
}

/** Compte de `rides` dont `scheduled_at` est dans [start, end?[. */
async function countRides(supabase: Supabase, start: string, end?: string): Promise<number> {
  let q = supabase
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .gte('scheduled_at', start);
  if (end) q = q.lt('scheduled_at', end);
  const res = await q;
  return res.count ?? 0;
}

/**
 * CA encaissé du mois + ventilation par méthode de paiement.
 * Réutilise la définition « encaissé » de `listRidesEncaissees`
 * (`queries-caisse.ts`) : `status='terminee'` + `payment_status='encaisse'`,
 * réduction `by_method` — appliquée aux bornes mensuelles.
 */
async function getCaMois(supabase: Supabase, start: string, end: string): Promise<CaisseTotals> {
  const empty: CaisseTotals = { total_eur: 0, count: 0, by_method: {} };
  const res = await supabase
    .from('rides')
    .select('tarif_amount_eur, payment_method')
    .eq('status', 'terminee')
    .eq('payment_status', 'encaisse')
    .gte('ended_at', start)
    .lt('ended_at', end);
  if (res.error || !res.data) return empty;
  return (
    res.data as { tarif_amount_eur: number | null; payment_method: string | null }[]
  ).reduce<CaisseTotals>(
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
}

async function getIncidents(
  supabase: Supabase,
  start: string,
  end: string,
): Promise<DashboardIncidents> {
  const [total, annulRes, noShowRes] = await Promise.all([
    countRides(supabase, start, end),
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .in('status', STATUTS_ANNULEE),
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .not('no_show_at', 'is', null),
  ]);
  const annulations = annulRes.count ?? 0;
  const noShow = noShowRes.count ?? 0;
  const taux = total > 0 ? Math.round(((noShow + annulations) / total) * 100) : 0;
  return { taux, noShow, annulations, total };
}

async function getChauffeurs(supabase: Supabase): Promise<DashboardChauffeurs> {
  const { start, end } = utcDayBounds();
  const [actifsRes, ridesRes] = await Promise.all([
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('actif', true)
      .eq('archive', false),
    supabase
      .from('rides')
      .select('driver_id')
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .not('driver_id', 'is', null),
  ]);
  const totalActifs = actifsRes.count ?? 0;
  const ridesDuJour = (ridesRes.data as { driver_id: string }[] | null) ?? [];
  const actifsAvecCourse = new Set(ridesDuJour.map((r) => r.driver_id)).size;
  const moyenneParChauffeur =
    actifsAvecCourse > 0 ? Math.round(ridesDuJour.length / actifsAvecCourse) : 0;
  return { actifsAvecCourse, totalActifs, moyenneParChauffeur };
}

function latestUpdatedAt(res: { data: unknown }): string | undefined {
  return (res.data as { updated_at: string }[] | null)?.[0]?.updated_at;
}

async function getConformite(supabase: Supabase): Promise<DashboardConformite> {
  const [registreRes, dpaRes, dpiaRes, majRegistre, majDpa, majDpia] = await Promise.all([
    supabase.from('data_processing_register').select('id', { count: 'exact', head: true }),
    supabase.from('dpa_record').select('id', { count: 'exact', head: true }),
    supabase
      .from('dpia_record')
      .select('status')
      .order('reviewed_at', { ascending: false })
      .limit(1),
    supabase
      .from('data_processing_register')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('dpa_record')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('dpia_record')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1),
  ]);
  const dpiaStatut = (dpiaRes.data as { status: string }[] | null)?.[0]?.status ?? 'aucune';
  const majDates = [majRegistre, majDpa, majDpia]
    .map(latestUpdatedAt)
    .filter((d): d is string => !!d)
    .sort();
  return {
    registreCount: registreRes.count ?? 0,
    dpaCount: dpaRes.count ?? 0,
    dpiaStatut,
    derniereMaj: majDates.at(-1) ?? null,
  };
}

/** Agrégat complet du tableau de bord — appelé par le Server Component. */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();
  const mois = currentMonth();
  const { start: moisStart, end: moisEnd } = monthBounds(mois);
  const jour = utcDayBounds();

  const [
    coursesFacturables,
    facturesIncompletes,
    noShowsRes,
    caMois,
    volAujourdhui,
    volSemaine,
    volMois,
    incidents,
    chauffeurs,
    conformite,
  ] = await Promise.all([
    getCoursesFacturables(mois),
    getCountCoursesSansTarif(mois),
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .gte('no_show_at', isoDaysAgo(7)),
    getCaMois(supabase, moisStart, moisEnd),
    countRides(supabase, jour.start, jour.end),
    countRides(supabase, isoDaysAgo(7)),
    countRides(supabase, moisStart, moisEnd),
    getIncidents(supabase, moisStart, moisEnd),
    getChauffeurs(supabase),
    getConformite(supabase),
  ]);

  return {
    coursesAFacturer: coursesFacturables.length,
    facturesIncompletes,
    noShowsRecents: noShowsRes.count ?? 0,
    caMois,
    volume: { aujourdhui: volAujourdhui, semaine: volSemaine, mois: volMois },
    incidents,
    chauffeurs,
    conformite,
  };
}
