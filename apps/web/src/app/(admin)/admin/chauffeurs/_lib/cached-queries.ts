import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DriverInvitationRow, DriverRow } from '../page';

/**
 * Data-cache par organisation pour la page chauffeurs (DEC-152, perf Lot 08.03).
 *
 * Pourquoi un cache par ORG et pas la page entière : la page lit les cookies
 * (session → org) donc elle reste rendue dynamiquement (pas de fuite de rendu
 * HTML inter-org possible). On cache seulement la DONNÉE, avec une clé ET un tag
 * qui incluent `organizationId` → deux organisations ne partagent JAMAIS une
 * entrée de cache. Le tag est purgé à chaque écriture (revalidateTag dans les
 * Server Actions) → fraîcheur immédiate.
 *
 * ⚠️ SÉCURITÉ MULTI-TENANT (NON NÉGOCIABLE) : `getChauffeursPageData` s'exécute
 * DANS `unstable_cache`, hors scope de session → le client RLS (cookies) n'y est
 * pas disponible. On utilise donc le client service-role (qui CONTOURNE la RLS)
 * et on filtre EXPLICITEMENT `.eq('organization_id', organizationId)` sur CHAQUE
 * requête. `organizationId` vient de la clé de cache (dérivée de la session via
 * getAuthContext côté page). Une requête sans ce filtre = fuite inter-org. Ce
 * fichier est le SEUL point où le service-role lit ces référentiels en cache —
 * toute requête y filtre l'org.
 */

/** Tag d'invalidation par organisation (purgé par revalidateTag à l'écriture). */
export function chauffeursTag(organizationId: string): string {
  return `chauffeurs:${organizationId}`;
}

export type ChauffeursPageData = {
  drivers: DriverRow[];
  nextComplianceByDriverId: Record<string, string>;
};

async function getChauffeursPageData(
  organizationId: string,
  vueArchives: boolean,
): Promise<ChauffeursPageData> {
  const admin = createAdminClient();

  // Les 3 requêtes filtrent TOUTES explicitement par organization_id (RLS
  // bypassée par le service-role — le filtre org est l'unique barrière ici).
  const [driversRes, invitationsRes, complianceRes] = await Promise.all([
    admin
      .from('drivers')
      .select(
        'id, nom_affichage, telephone, numero_licence, type_permis, status, actif, archive, archive_at, archive_motif, profile_id, created_at',
      )
      .eq('organization_id', organizationId)
      .eq('archive', vueArchives)
      .order('nom_affichage', { ascending: true }),
    admin
      .from('driver_invitations')
      .select('id, driver_id, email, status, expires_at, created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    admin
      .from('compliance_items')
      .select('entity_id, expires_at')
      .eq('organization_id', organizationId)
      .eq('entity_type', 'driver')
      .eq('archive', false)
      .not('expires_at', 'is', null)
      .order('expires_at', { ascending: true }),
  ]);

  if (driversRes.error) {
    console.error('[admin/chauffeurs] drivers query error', {
      message: driversRes.error.message,
      code: driversRes.error.code,
      organization_id: organizationId,
      vue_archives: vueArchives,
    });
  }
  if (invitationsRes.error) {
    console.error('[admin/chauffeurs] invitations query error', {
      message: invitationsRes.error.message,
      code: invitationsRes.error.code,
    });
  }

  const invitationByDriverId = new Map<string, DriverInvitationRow>();
  for (const inv of (invitationsRes.data ?? []) as DriverInvitationRow[]) {
    if (!invitationByDriverId.has(inv.driver_id)) {
      invitationByDriverId.set(inv.driver_id, inv);
    }
  }

  // `status` est absent de types.gen.ts (pas de resync) → cast via unknown
  // (DEC-155). Le SELECT le ramène bien à l'exécution.
  const drivers: DriverRow[] = (
    (driversRes.data ?? []) as unknown as Omit<DriverRow, 'invitation'>[]
  ).map((d) => ({ ...d, invitation: invitationByDriverId.get(d.id) ?? null }));

  const nextComplianceByDriverId: Record<string, string> = {};
  for (const r of (complianceRes.data as { entity_id: string; expires_at: string }[] | null) ??
    []) {
    if (!nextComplianceByDriverId[r.entity_id]) {
      nextComplianceByDriverId[r.entity_id] = r.expires_at;
    }
  }

  return { drivers, nextComplianceByDriverId };
}

/**
 * Variante cachée par organisation. Clé = ['chauffeurs-page', orgId, vue] →
 * étanche entre orgs et entre vues actifs/archivés. Filet temporel 1h ;
 * l'invalidation réelle vient de revalidateTag(chauffeursTag(org)) à l'écriture.
 */
export function getCachedChauffeursPageData(
  organizationId: string,
  vueArchives: boolean,
): Promise<ChauffeursPageData> {
  return unstable_cache(
    () => getChauffeursPageData(organizationId, vueArchives),
    ['chauffeurs-page', organizationId, vueArchives ? 'archives' : 'actifs'],
    { tags: [chauffeursTag(organizationId)], revalidate: 3600 },
  )();
}
