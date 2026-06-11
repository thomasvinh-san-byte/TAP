import 'server-only';
import { entityComplianceState, isPlanningBlocking, type EntityComplianceState } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Helpers serveur — contrôle conformité à la planification (Phase 06.35,
 * DEC-114, CdC §5.21 lot 3).
 *
 * Lit le réglage `compliance_blocking_mode` de l'organisation active +
 * agrège l'état des compliance_items des entités cibles
 * (driver/vehicle). Partagé `assignRideAction` (revérif serveur) et
 * `route.ts` optimiseur (filtrage `excluded`).
 *
 * RLS Postgres `compliance_items_select_same_org` + `organizations_*`
 * font le cloisonnement multi-tenant — pas de jointure `organization_id`
 * en applicatif.
 */

export type ComplianceBlockingMode = 'warn' | 'block';

export interface EntityComplianceLookup {
  /** Carte driver_id → état agrégé. */
  byDriverId: Record<string, EntityComplianceState>;
  /** Carte vehicle_id → état agrégé. */
  byVehicleId: Record<string, EntityComplianceState>;
}

/**
 * Lit le mode de blocage org. Défaut `'warn'` si la colonne est null
 * ou la lecture échoue (fail-open : on ne bloque pas le travail
 * régulatrice à cause d'une erreur d'infrastructure).
 */
export async function getComplianceBlockingMode(): Promise<ComplianceBlockingMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('compliance_blocking_mode')
    .limit(1)
    .maybeSingle();
  const row = data as { compliance_blocking_mode: ComplianceBlockingMode | null } | null;
  return row?.compliance_blocking_mode ?? 'warn';
}

/**
 * Construit la lookup d'état conformité pour un ensemble de
 * driver_ids et vehicle_ids — utilisée par l'optimiseur ET
 * l'assign-modal (charge côté server, pas couplé client).
 */
export async function getEntityComplianceLookup(
  driverIds: string[],
  vehicleIds: string[],
): Promise<EntityComplianceLookup> {
  const lookup: EntityComplianceLookup = { byDriverId: {}, byVehicleId: {} };
  if (driverIds.length === 0 && vehicleIds.length === 0) return lookup;

  const supabase = await createClient();
  const wantedTypes: string[] = [];
  if (driverIds.length > 0) wantedTypes.push('driver');
  if (vehicleIds.length > 0) wantedTypes.push('vehicle');

  const { data, error } = await supabase
    .from('compliance_items')
    .select('entity_type, entity_id, expires_at')
    .eq('archive', false)
    .in('entity_type', wantedTypes);

  if (error || !data) return lookup;
  const items = data as { entity_type: string; entity_id: string; expires_at: string | null }[];

  const byDriver: Record<string, { expires_at: string | null }[]> = {};
  const byVehicle: Record<string, { expires_at: string | null }[]> = {};
  for (const it of items) {
    if (it.entity_type === 'driver' && driverIds.includes(it.entity_id)) {
      (byDriver[it.entity_id] ??= []).push({ expires_at: it.expires_at });
    } else if (it.entity_type === 'vehicle' && vehicleIds.includes(it.entity_id)) {
      (byVehicle[it.entity_id] ??= []).push({ expires_at: it.expires_at });
    }
  }

  for (const id of driverIds) {
    lookup.byDriverId[id] = entityComplianceState(byDriver[id] ?? []);
  }
  for (const id of vehicleIds) {
    lookup.byVehicleId[id] = entityComplianceState(byVehicle[id] ?? []);
  }
  return lookup;
}

/**
 * Vérifie qu'une assignation est ACCEPTABLE compte tenu du mode org.
 *   - mode 'warn' : toujours accepté (la régulatrice garde la main, son
 *                   avertissement client-side suffit).
 *   - mode 'block' : refusé si driver OU vehicle a au moins une
 *                    échéance expirée (`isPlanningBlocking`).
 *
 * Utilisé par `assignRideAction` (defense in depth : la décision client
 * est revérifiée serveur).
 */
export async function checkAssignmentCompliance(
  driverId: string,
  vehicleId: string | null,
  mode?: ComplianceBlockingMode,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const effectiveMode = mode ?? (await getComplianceBlockingMode());
  if (effectiveMode === 'warn') return { allowed: true };

  const lookup = await getEntityComplianceLookup([driverId], vehicleId ? [vehicleId] : []);
  const driverState = lookup.byDriverId[driverId];
  const vehicleState = vehicleId ? lookup.byVehicleId[vehicleId] : undefined;

  if (driverState && isPlanningBlocking(driverState)) {
    return {
      allowed: false,
      reason:
        'Chauffeur non conforme (au moins une échéance expirée). Régularisez dans /admin/conformite.',
    };
  }
  if (vehicleState && isPlanningBlocking(vehicleState)) {
    return {
      allowed: false,
      reason:
        'Véhicule non conforme (au moins une échéance expirée). Régularisez dans /admin/conformite.',
    };
  }
  return { allowed: true };
}
