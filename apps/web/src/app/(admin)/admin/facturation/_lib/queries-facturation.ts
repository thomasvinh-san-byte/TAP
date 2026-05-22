import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Requêtes serveur de la facturation CGSS (Phase 06 PLAN-2, Bloc A).
 *
 * SOURCE UNIQUE de la définition « course facturable CGSS » — partagée par
 * la page `/admin/facturation` (aperçu) et le Route Handler PDF, pour que
 * l'aperçu et le document ne divergent jamais.
 *
 * Définition actée (PLAN-2 — corrige le S-03 de l'UI-SPEC) : une course est
 * facturable CGSS si elle est `terminee`, tarifée (`tarif_amount_eur` non
 * null), `ended_at` dans le mois, et que le payeur est le tiers payant CGSS
 * — c.-à-d. PAS encaissée en propre par le patient (cash/CB/chèque).
 * `payment_method` est NULL sur ~100 % des courses (contrainte
 * `rides_payment_encaisse_complet`) : on ne filtre donc PAS dessus, le
 * discriminant est l'exclusion du paiement direct.
 *
 * RLS Postgres scope automatiquement par `organization_id`.
 */

export interface CourseFacturable {
  id: string;
  ended_at: string;
  tarif_amount_eur: number;
  pickup_address: string;
  dropoff_address: string;
  driver_id: string;
  patient_nom: string;
  patient_prenom: string;
  driver_nom: string;
}

export interface ChauffeurOption {
  id: string;
  nom: string;
}

interface RawRow {
  id: string;
  ended_at: string;
  tarif_amount_eur: number;
  pickup_address: string;
  dropoff_address: string;
  driver_id: string;
  patient: { nom: string; prenom: string } | null;
  driver: { nom_affichage: string } | null;
}

/** Bornes UTC [début, fin[ du mois `YYYY-MM`. Réutilisé par le tableau de bord. */
export function monthBounds(mois: string): { start: string; end: string } {
  const y = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7));
  return {
    start: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    end: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

/** Filtre commun « payeur = tiers payant CGSS » : exclut le paiement direct. */
const TIERS_PAYANT_OR = 'payment_status.neq.encaisse,payment_method.not.in.(cash,cb,cheque)';

/**
 * Courses facturables CGSS d'un mois, triées par date d'exécution croissante.
 * Filtre chauffeur optionnel.
 */
export async function getCoursesFacturables(
  mois: string,
  chauffeurId?: string,
): Promise<CourseFacturable[]> {
  const supabase = createClient();
  const { start, end } = monthBounds(mois);
  const base = supabase
    .from('rides')
    .select(
      `id, ended_at, tarif_amount_eur, pickup_address, dropoff_address, driver_id,
       patient:patients!inner(nom, prenom),
       driver:drivers(nom_affichage)`,
    )
    .eq('status', 'terminee')
    .not('tarif_amount_eur', 'is', null)
    .gte('ended_at', start)
    .lt('ended_at', end)
    .or(TIERS_PAYANT_OR);
  const scoped = chauffeurId ? base.eq('driver_id', chauffeurId) : base;
  // Cast contenu : le parseur de types du select à embeds de
  // `@supabase/postgrest-js` dégrade la réponse en `never` (skew de types
  // Supabase, cf. CONCERNS.md) — la requête est valide à l'exécution.
  const res = (await scoped.order('ended_at', { ascending: true })) as unknown as {
    data: RawRow[] | null;
    error: unknown;
  };
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    id: r.id,
    ended_at: r.ended_at,
    tarif_amount_eur: Number(r.tarif_amount_eur),
    pickup_address: r.pickup_address,
    dropoff_address: r.dropoff_address,
    driver_id: r.driver_id,
    patient_nom: r.patient?.nom ?? '',
    patient_prenom: r.patient?.prenom ?? '',
    driver_nom: r.driver?.nom_affichage ?? '',
  }));
}

/**
 * Décompte des courses CGSS clôturées mais SANS tarif sur la période
 * (alimente l'avertissement « facture incomplète » de l'aperçu).
 */
export async function getCountCoursesSansTarif(
  mois: string,
  chauffeurId?: string,
): Promise<number> {
  const supabase = createClient();
  const { start, end } = monthBounds(mois);
  let q = supabase
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'terminee')
    .is('tarif_amount_eur', null)
    .gte('ended_at', start)
    .lt('ended_at', end)
    .or(TIERS_PAYANT_OR);
  if (chauffeurId) q = q.eq('driver_id', chauffeurId);

  const res = await q;
  return res.count ?? 0;
}

/** Liste des chauffeurs pour le sélecteur de périmètre. */
export async function getChauffeursForSelector(): Promise<ChauffeurOption[]> {
  const supabase = createClient();
  const res = await supabase
    .from('drivers')
    .select('id, nom_affichage')
    .order('nom_affichage', { ascending: true });
  if (res.error || !res.data) return [];
  return (res.data as { id: string; nom_affichage: string }[]).map((d) => ({
    id: d.id,
    nom: d.nom_affichage,
  }));
}
