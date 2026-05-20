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
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const res = await supabase
    .from('tariff_grids' as never)
    .select(
      'forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, ' +
        'supplement_tpmr_eur, majoration_pct, facteur_correction_routier, arrondi_eur',
    )
    .lte('date_effet', today)
    .order('date_effet', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (res.data as TariffGrid | null) ?? null;
}

/** Jours fériés 974 (YYYY-MM-DD) pour la majoration pricing (DEC-059). */
export async function getHolidays974(): Promise<string[]> {
  const supabase = createClient();
  const res = await supabase.from('holidays_974' as never).select('date');
  if (res.error || !res.data) return [];
  return (res.data as { date: string }[]).map((r) => r.date);
}
