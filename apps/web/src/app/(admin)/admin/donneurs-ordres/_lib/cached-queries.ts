import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OrderingPartyRow } from '../page';

/**
 * Data-cache par organisation pour la page donneurs d'ordres (DEC-153, perf
 * 08.04). Réplique le pattern validé du pilote chauffeurs (DEC-152).
 *
 * ⚠️ SÉCURITÉ MULTI-TENANT : exécuté dans `unstable_cache` (cookies
 * indisponibles) → client service-role (CONTOURNE la RLS) AVEC filtre
 * `.eq('organization_id', organizationId)` explicite. `organizationId` vient de
 * la clé de cache (dérivée de la session côté page). Filtre org = unique
 * barrière anti-fuite. Service-role confiné à ce fichier.
 */

/** Tag d'invalidation par organisation (purgé par revalidateTag à l'écriture). */
export function donneursOrdresTag(organizationId: string): string {
  return `donneurs-ordres:${organizationId}`;
}

async function getDonneursOrdresPageData(organizationId: string): Promise<OrderingPartyRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('ordering_parties')
    .select(
      'id, raison_sociale, siret, contact_principal_nom, contact_principal_telephone, contact_principal_email, modalite_facturation, actif, created_at',
    )
    .eq('organization_id', organizationId)
    .eq('archive', false)
    .order('raison_sociale', { ascending: true });

  if (error) {
    console.error('[admin/donneurs-ordres] Erreur Supabase:', error);
  }

  return (data ?? []) as OrderingPartyRow[];
}

export function getCachedDonneursOrdresPageData(
  organizationId: string,
): Promise<OrderingPartyRow[]> {
  return unstable_cache(
    () => getDonneursOrdresPageData(organizationId),
    ['donneurs-ordres-page', organizationId],
    { tags: [donneursOrdresTag(organizationId)], revalidate: 3600 },
  )();
}
