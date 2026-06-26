import 'server-only';
import type { TariffGrid } from '@tap/pricing';
import { createClient } from '@/lib/supabase/server';

/**
 * Grille tarifaire active = celle dont `date_effet` est la plus récente
 * ≤ aujourd'hui pour l'organisation (DEC-057). RLS `tariff_grids_select_org`
 * scope déjà à l'organisation — pas de filtre explicite nécessaire.
 *
 * Lecture server-side uniquement (Server Component / Server Action).
 */
export async function getActiveTariffGrid(): Promise<TariffGrid | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const res = await supabase
    .from('tariff_grids')
    .select(
      'forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, ' +
        'supplement_tpmr_eur, supplement_accompagnant_eur, majoration_pct, ' +
        'facteur_correction_routier, arrondi_eur',
    )
    .lte('date_effet', today)
    .order('date_effet', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (res.data as TariffGrid | null) ?? null;
}

/** Jours fériés 974 (YYYY-MM-DD) pour la majoration pricing (DEC-059). */
export async function getHolidays974(): Promise<string[]> {
  const supabase = await createClient();
  const res = await supabase.from('holidays_974' as never).select('date');
  if (res.error || !res.data) return [];
  return (res.data as { date: string }[]).map((r) => r.date);
}

const GRID_COLUMNS =
  'forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, ' +
  'supplement_tpmr_eur, majoration_pct, facteur_correction_routier, arrondi_eur';

/**
 * Grille tarifaire à appliquer à une course rattachée à un donneur d'ordres
 * (DEC-157). Renvoie la grille PROPRE du donneur (active à `date`) SI son
 * `tariff_mode = 'grille_propre'` ET qu'une grille existe ; sinon `null`
 * (l'appelant retombe sur la grille CGSS de l'org — comportement par défaut,
 * INCHANGÉ). Le moteur `computeCgssFromDistance` n'est pas modifié : on ne fait
 * que choisir la grille injectée. RLS scope l'org.
 */
export async function getActiveTariffGridForOrderingParty(
  orderingPartyId: string,
  on: string = new Date().toISOString().slice(0, 10),
): Promise<TariffGrid | null> {
  const supabase = await createClient();

  const partyRes = await supabase
    // `as never` : colonne tariff_mode (DEC-157) absente de types.gen.ts jusqu'au resync.
    .from('ordering_parties' as never)
    .select('tariff_mode')
    .eq('id', orderingPartyId)
    .maybeSingle();
  const mode = (partyRes.data as { tariff_mode: string } | null)?.tariff_mode;
  if (mode !== 'grille_propre') return null;

  const gridRes = await supabase
    .from('ordering_party_tariff_grids' as never)
    .select(GRID_COLUMNS)
    .eq('ordering_party_id', orderingPartyId)
    .lte('date_effet', on)
    .order('date_effet', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (gridRes.data as TariffGrid | null) ?? null;
}
