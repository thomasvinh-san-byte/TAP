import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PrescriberRow } from '../page';

/**
 * Data-cache par organisation pour la page prescripteurs (DEC-162, réplique le
 * pattern data-cache 08.03/08.04 — DEC-152/153).
 *
 * ⚠️ SÉCURITÉ MULTI-TENANT : exécuté dans `unstable_cache` (cookies
 * indisponibles) → client service-role (CONTOURNE la RLS) AVEC filtre
 * `.eq('organization_id', organizationId)` explicite. `organizationId` vient de
 * la clé de cache (dérivée de la session côté page). Filtre org = unique
 * barrière anti-fuite. Service-role confiné à ce fichier.
 */

/** Tag d'invalidation par organisation (purgé par revalidateTag à l'écriture). */
export function prescribersTag(organizationId: string): string {
  return `prescribers:${organizationId}`;
}

async function getPrescribersPageData(organizationId: string): Promise<PrescriberRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    // `as never` : table prescribers (DEC-162) absente de types.gen.ts jusqu'au
    // prochain resync — à retirer alors (cf. registre §5).
    .from('prescribers' as never)
    .select(
      'id, nom, prenom, type, rpps, adeli, finess, specialite, contact_telephone, contact_email, adresse, actif, created_at',
    )
    .eq('organization_id', organizationId)
    .eq('archive', false)
    .order('nom', { ascending: true });

  if (error) {
    console.error('[admin/prescripteurs] Erreur Supabase:', error);
  }

  return (data ?? []) as PrescriberRow[];
}

export function getCachedPrescribersPageData(organizationId: string): Promise<PrescriberRow[]> {
  return unstable_cache(
    () => getPrescribersPageData(organizationId),
    ['prescripteurs-page', organizationId],
    { tags: [prescribersTag(organizationId)], revalidate: 3600 },
  )();
}
