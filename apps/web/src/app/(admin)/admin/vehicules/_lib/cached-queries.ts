import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { VehicleRow } from '../page';

/**
 * Data-cache par organisation pour la page véhicules (DEC-153, perf 08.04).
 * Réplique le pattern validé du pilote chauffeurs (DEC-152).
 *
 * ⚠️ SÉCURITÉ MULTI-TENANT : exécuté dans `unstable_cache` (cookies
 * indisponibles) → client service-role (CONTOURNE la RLS) AVEC filtre
 * `.eq('organization_id', organizationId)` explicite sur CHAQUE requête.
 * `organizationId` vient de la clé de cache (dérivée de la session côté page).
 * Le filtre org est l'unique barrière anti-fuite ici. Service-role confiné à
 * ce fichier.
 */

/** Tag d'invalidation par organisation (purgé par revalidateTag à l'écriture). */
export function vehiculesTag(organizationId: string): string {
  return `vehicules:${organizationId}`;
}

export type VehiculesPageData = {
  vehicles: VehicleRow[];
  nextComplianceByVehicleId: Record<string, string>;
};

async function getVehiculesPageData(organizationId: string): Promise<VehiculesPageData> {
  const admin = createAdminClient();

  const [vehiclesRes, complianceRes] = await Promise.all([
    admin
      .from('vehicles' as never)
      .select(
        'id, immatriculation, marque, modele, type, places_assises, places_tpmr, actif, created_at',
      )
      .eq('organization_id', organizationId)
      .eq('archive', false)
      .order('immatriculation', { ascending: true }),
    admin
      .from('compliance_items' as never)
      .select('entity_id, expires_at')
      .eq('organization_id', organizationId)
      .eq('entity_type', 'vehicle')
      .eq('archive', false)
      .not('expires_at', 'is', null)
      .order('expires_at', { ascending: true }),
  ]);

  if (vehiclesRes.error) {
    console.error('[admin/vehicules] Erreur Supabase:', vehiclesRes.error);
  }

  const vehicles = (vehiclesRes.data ?? []) as VehicleRow[];

  const nextComplianceByVehicleId: Record<string, string> = {};
  for (const r of (complianceRes.data as { entity_id: string; expires_at: string }[] | null) ??
    []) {
    if (!nextComplianceByVehicleId[r.entity_id]) {
      nextComplianceByVehicleId[r.entity_id] = r.expires_at;
    }
  }

  return { vehicles, nextComplianceByVehicleId };
}

export function getCachedVehiculesPageData(organizationId: string): Promise<VehiculesPageData> {
  return unstable_cache(
    () => getVehiculesPageData(organizationId),
    ['vehicules-page', organizationId],
    { tags: [vehiculesTag(organizationId)], revalidate: 3600 },
  )();
}
