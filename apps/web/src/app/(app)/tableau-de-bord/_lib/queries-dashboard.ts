import 'server-only';
import { RIDE_CANCELLED_STATUSES } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import {
  getCoursesFacturables,
  getCountCoursesSansTarif,
  monthBounds,
} from '@/app/(admin)/admin/facturation/_lib/queries-facturation';
import type { CaisseTotals } from '@/app/(app)/courses/caisse/_lib/queries-caisse';
import { getSlaRules, type SlaRule } from './sla-status';

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

// DEC-173 : source unique (inclut annulee_meteo) — plus d'énumération en dur.
const STATUTS_ANNULEE: readonly string[] = RIDE_CANCELLED_STATUSES;

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

/** Top prescripteur (CdG §5.4/§5.20, DEC-164) — par nombre de prescriptions. */
export interface TopPrescripteur {
  prescriber_id: string;
  label: string;
  count: number;
}

/** KPIs prescriptions / bons de transport (CdG §5.20, DEC-164). */
export interface DashboardPrescriptions {
  bonsActifs: number;
  bonsProchesSeuil: number; // actifs à ≥ 80 % de consommation (aligné alerte 07.06)
  bonsEpuises: number;
  bonsExpires: number;
  topPrescripteurs: TopPrescripteur[];
}

/** Top donneur d'ordres B2B en CA (CdG §5.20 l.504, DEC-165). */
export interface TopDonneur {
  ordering_party_id: string;
  label: string;
  ca_eur: number;
  count: number;
}

/**
 * Tops commerciaux du mois (DEC-165). CA = MÊME définition que `getCaMois`
 * (status='terminee' + payment_status='encaisse', bornes `ended_at`) → les tops
 * sont une PARTITION du CA mensuel, garantissant la cohérence (chaque top ≤
 * caMois).
 *
 * KPI-01 : le « top patients en CA » a été retiré (classer des patients
 * vulnérables par le CA généré est délicat en transport sanitaire). Le top
 * donneurs d'ordres porte le même signal de concentration commerciale sans
 * exposer d'individus.
 */
export interface DashboardCommercial {
  topDonneurs: TopDonneur[];
}

export interface DashboardData {
  coursesAFacturer: number;
  moisCourant: string; // YYYY-MM — mois compté par coursesAFacturer (drill-down)
  facturesIncompletes: number;
  noShowsRecents: number;
  caMois: CaisseTotals;
  volume: DashboardVolume;
  incidents: DashboardIncidents;
  chauffeurs: DashboardChauffeurs;
  conformite: DashboardConformite;
  prescriptions: DashboardPrescriptions;
  commercial: DashboardCommercial;
  // Wave 1 Phase 06.11 — A4 comparatif N vs N-1
  caMoisPrec: CaisseTotals;
  volMoisPrec: number;
  incidentsPrec: DashboardIncidents;
  // Wave 1 Phase 06.11 — A3 SLA factuels datés
  slaRules: SlaRule[];
  // Wave 1 Phase 06.11 — A5 nouvelles règles d'alertes
  coursesTermineesSansTarif48h: number;
  chauffeursInactifs7j: number;
  smsFailed24h: number;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Mois précédent au format `YYYY-MM`. Gère le wrap année (`2026-01` → `2025-12`).
 * Wave 1 Phase 06.11 — A4 comparatif N vs N-1.
 */
function previousMonth(ym: string): string {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
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
      .in('status', [...STATUTS_ANNULEE]),
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

/**
 * KPIs prescriptions / bons de transport (CdG §5.4/§5.20, DEC-164) — agrégation
 * PURE LECTURE (ne touche NI le compteur NI le statut 07.06). Comptes par statut
 * + bons proches du seuil 80 % + Top 5 prescripteurs, en 1 select (puis libellés
 * des 5 en 1 `.in()`, anti-N+1). RLS Postgres scope l'org. Fallback gracieux.
 */
async function getPrescriptions(supabase: Supabase): Promise<DashboardPrescriptions> {
  const empty: DashboardPrescriptions = {
    bonsActifs: 0,
    bonsProchesSeuil: 0,
    bonsEpuises: 0,
    bonsExpires: 0,
    topPrescripteurs: [],
  };
  const res = await supabase
    .from('prescriptions' as never)
    .select('statut, prescriber_id, trajets_autorises, trajets_consommes')
    .limit(5000);
  if (res.error) {
    console.error('[dashboard/prescriptions] read error', res.error.message);
    return empty;
  }
  const rows =
    (res.data as
      | {
          statut: string;
          prescriber_id: string | null;
          trajets_autorises: number;
          trajets_consommes: number;
        }[]
      | null) ?? [];

  let bonsActifs = 0;
  let bonsProchesSeuil = 0;
  let bonsEpuises = 0;
  let bonsExpires = 0;
  const byPrescriber = new Map<string, number>();
  for (const r of rows) {
    if (r.statut === 'active') {
      bonsActifs += 1;
      if (r.trajets_autorises > 0 && r.trajets_consommes / r.trajets_autorises >= 0.8) {
        bonsProchesSeuil += 1;
      }
    } else if (r.statut === 'epuisee') {
      bonsEpuises += 1;
    } else if (r.statut === 'expiree') {
      bonsExpires += 1;
    }
    if (r.prescriber_id) {
      byPrescriber.set(r.prescriber_id, (byPrescriber.get(r.prescriber_id) ?? 0) + 1);
    }
  }

  const top = [...byPrescriber.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const labels = new Map<string, string>();
  if (top.length > 0) {
    const { data } = await supabase
      .from('prescribers')
      .select('id, nom, prenom')
      .in(
        'id',
        top.map(([id]) => id),
      );
    for (const p of (data as { id: string; nom: string; prenom: string | null }[] | null) ?? []) {
      labels.set(p.id, [p.nom, p.prenom].filter(Boolean).join(' '));
    }
  }

  return {
    bonsActifs,
    bonsProchesSeuil,
    bonsEpuises,
    bonsExpires,
    topPrescripteurs: top.map(([id, count]) => ({
      prescriber_id: id,
      label: labels.get(id) ?? 'Prescripteur',
      count,
    })),
  };
}

/**
 * Tops commerciaux du mois (CdG §5.20 l.502/504, DEC-165) — Top 10 patients +
 * Top 5 donneurs B2B par CA. Agrégation PURE LECTURE. **1 requête courses** (même
 * définition CA que `getCaMois` : terminee + encaisse, bornes `ended_at` → les
 * tops partitionnent le CA mensuel) → agrégation en mémoire → libellés en 2
 * `.in()` (patients_safe RGPD + ordering_parties). RLS scope l'org. Anti-N+1.
 */
async function getCommercialTops(
  supabase: Supabase,
  moisStart: string,
  moisEnd: string,
): Promise<DashboardCommercial> {
  const empty: DashboardCommercial = { topDonneurs: [] };
  const res = await supabase
    .from('rides')
    .select('ordering_party_id, tarif_amount_eur')
    .eq('status', 'terminee')
    .eq('payment_status', 'encaisse')
    .gte('ended_at', moisStart)
    .lt('ended_at', moisEnd);
  if (res.error) {
    console.error('[dashboard/commercial] read error', res.error.message);
    return empty;
  }
  const rows =
    (res.data as { ordering_party_id: string | null; tarif_amount_eur: number | null }[] | null) ??
    [];

  const byDonneur = new Map<string, { ca: number; count: number }>();
  for (const r of rows) {
    if (!r.ordering_party_id) continue;
    const amount = Number(r.tarif_amount_eur ?? 0);
    const dAcc = byDonneur.get(r.ordering_party_id) ?? { ca: 0, count: 0 };
    dAcc.ca += amount;
    dAcc.count += 1;
    byDonneur.set(r.ordering_party_id, dAcc);
  }

  const topDonneursRaw = [...byDonneur.entries()].sort((a, b) => b[1].ca - a[1].ca).slice(0, 5);
  if (topDonneursRaw.length === 0) return empty;

  // Libellés en 1 requête `.in()` (ordering_parties).
  const donneursRes = await supabase
    .from('ordering_parties')
    .select('id, raison_sociale')
    .in(
      'id',
      topDonneursRaw.map(([id]) => id),
    );

  const donneurLabels = new Map<string, string>();
  for (const d of (donneursRes.data as { id: string; raison_sociale: string }[] | null) ?? []) {
    donneurLabels.set(d.id, d.raison_sociale);
  }

  return {
    topDonneurs: topDonneursRaw.map(([id, v]) => ({
      ordering_party_id: id,
      label: donneurLabels.get(id) ?? "Donneur d'ordres",
      ca_eur: v.ca,
      count: v.count,
    })),
  };
}

/** Agrégat complet du tableau de bord — appelé par le Server Component. */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const mois = currentMonth();
  const { start: moisStart, end: moisEnd } = monthBounds(mois);
  const moisPrec = previousMonth(mois);
  const { start: precStart, end: precEnd } = monthBounds(moisPrec);
  const jour = utcDayBounds();
  const sansTarif48hThreshold = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const sms24hThreshold = isoDaysAgo(1);

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
    // DEC-164 — KPIs prescriptions / bons de transport.
    prescriptions,
    // DEC-165 — tops commerciaux (Top 10 patients CA + Top 5 donneurs B2B).
    commercial,
    // A4 comparatif N vs N-1
    caMoisPrec,
    volMoisPrec,
    incidentsPrec,
    // A3 SLA factuels datés
    slaRules,
    // A5 nouvelles règles d'alertes
    coursesTermineesSansTarif48hRes,
    smsFailed24hRes,
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
    getPrescriptions(supabase),
    getCommercialTops(supabase, moisStart, moisEnd),
    getCaMois(supabase, precStart, precEnd),
    countRides(supabase, precStart, precEnd),
    getIncidents(supabase, precStart, precEnd),
    getSlaRules(supabase),
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'terminee')
      .is('tarif_amount_eur', null)
      .lt('ended_at', sansTarif48hThreshold),
    supabase
      .from('sms_messages')
      .select('id', { count: 'exact', head: true })
      .in('delivery_status', ['failed', 'undelivered'])
      .gte('created_at', sms24hThreshold),
  ]);

  const chauffeursInactifs7j = await getChauffeursInactifs7j(supabase);

  return {
    coursesAFacturer: coursesFacturables.length,
    moisCourant: mois,
    facturesIncompletes,
    noShowsRecents: noShowsRes.count ?? 0,
    caMois,
    volume: { aujourdhui: volAujourdhui, semaine: volSemaine, mois: volMois },
    incidents,
    chauffeurs,
    conformite,
    prescriptions,
    commercial,
    caMoisPrec,
    volMoisPrec,
    incidentsPrec,
    slaRules,
    coursesTermineesSansTarif48h: coursesTermineesSansTarif48hRes.count ?? 0,
    chauffeursInactifs7j,
    smsFailed24h: smsFailed24hRes.count ?? 0,
  };
}

/**
 * Compte les chauffeurs actifs (`actif=true, archive=false`) qui n'ont aucune
 * course planifiée dans les 7 derniers jours. Wave 1 Phase 06.11 — A5.
 *
 * Implémentation en 2 requêtes (driver IDs actifs + IDs avec course récente)
 * + diff JS, plutôt qu'un NOT EXISTS SQL non disponible via PostgREST.
 */
async function getChauffeursInactifs7j(supabase: Supabase): Promise<number> {
  const since = isoDaysAgo(7);
  const [actifsRes, ridesRes] = await Promise.all([
    supabase.from('drivers').select('id').eq('actif', true).eq('archive', false),
    supabase
      .from('rides')
      .select('driver_id')
      .gte('scheduled_at', since)
      .not('driver_id', 'is', null),
  ]);
  const actifs = (actifsRes.data as { id: string }[] | null) ?? [];
  const ridesDrivers = new Set(
    ((ridesRes.data as { driver_id: string }[] | null) ?? []).map((r) => r.driver_id),
  );
  return actifs.filter((d) => !ridesDrivers.has(d.id)).length;
}
