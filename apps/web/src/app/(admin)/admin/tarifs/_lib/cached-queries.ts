import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TariffGridRow } from '../page';

/**
 * Data-cache par organisation pour la page grille tarifaire (DEC-153, perf
 * 08.04). Réplique le pattern validé du pilote chauffeurs (DEC-152).
 *
 * ⚠️ SÉCURITÉ MULTI-TENANT : exécuté dans `unstable_cache` (cookies
 * indisponibles) → client service-role (CONTOURNE la RLS) AVEC filtre
 * `.eq('organization_id', organizationId)` explicite. `organizationId` vient de
 * la clé de cache (dérivée de la session côté page). Filtre org = unique
 * barrière anti-fuite. Service-role confiné à ce fichier.
 *
 * NB : `tariff_grids` est versionnée par org (chaque modification crée une
 * nouvelle ligne datée) ; on cache l'historique complet, la page choisit la
 * grille active par date.
 */

/** Tag d'invalidation par organisation (purgé par revalidateTag à l'écriture). */
export function tarifsTag(organizationId: string): string {
  return `tarifs:${organizationId}`;
}

async function getTarifsPageData(organizationId: string): Promise<TariffGridRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('tariff_grids' as never)
    .select(
      'id, date_effet, forfait_eur, km_inclus, prix_km_eur, ' +
        'supplement_drom_eur, supplement_tpmr_eur, majoration_pct, ' +
        'facteur_correction_routier, arrondi_eur',
    )
    .eq('organization_id', organizationId)
    .order('date_effet', { ascending: false });

  if (error) {
    console.error('[admin/tarifs] Erreur Supabase:', error);
  }

  return (data as TariffGridRow[] | null) ?? [];
}

export function getCachedTarifsPageData(organizationId: string): Promise<TariffGridRow[]> {
  return unstable_cache(() => getTarifsPageData(organizationId), ['tarifs-page', organizationId], {
    tags: [tarifsTag(organizationId)],
    revalidate: 3600,
  })();
}
