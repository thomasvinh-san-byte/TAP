'use server';

/**
 * Wrappers Server Actions exposant les queries RSC du module Courses aux
 * Client Components via useQuery (DEC-005 : pas de useEffect-fetch).
 *
 * Convention : on importe dynamiquement `../_lib/queries` (resp.
 * `../_lib/queries-enriched`, re-exporté depuis `../_lib/queries`) pour
 * éviter qu'un éventuel import statique de `next/headers` ne contamine
 * un bundle client. L'exécution serveur est garantie par `'use server'`.
 */

import { z } from 'zod';
import { RIDES_LIST_FETCH_CAP } from '../_lib/list-config';

const listRidesParamsSchema = z.object({
  status: z.string().optional(),
  transport_mode: z.string().optional(),
  urgency: z.string().optional(),
  // Hotfix 04.7-bis : filtre date + pagination simple
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  // Borne alignée sur la source de vérité unique (client + requêtes). Un
  // plafond inférieur à la demande du client vidait la liste en silence.
  limit: z.number().int().min(1).max(RIDES_LIST_FETCH_CAP).optional(),
  offset: z.number().int().min(0).optional(),
});

/** RidesList Wave 4 (Phase 2) — version simple (sans jointures). */
export async function listRidesAction(params: z.infer<typeof listRidesParamsSchema> = {}) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) {
    // Ne plus avaler l'échec : journaliser la cause (auparavant `[]` muet, qui
    // masquait un écart de paramètres comme `limit` hors borne).
    console.error('[listRidesAction] Paramètres invalides', parsed.error.flatten());
    return [];
  }
  const { listRides } = await import('../_lib/queries');
  return listRides(parsed.data as Parameters<typeof listRides>[0]);
}

/** Variante enrichie : courses + patient/driver/vehicle joints (03-D). */
export async function listRidesEnrichedAction(params: z.infer<typeof listRidesParamsSchema> = {}) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) {
    console.error('[listRidesEnrichedAction] Paramètres invalides', parsed.error.flatten());
    return [];
  }
  const { listRidesEnriched } = await import('../_lib/queries');
  return listRidesEnriched(parsed.data as Parameters<typeof listRidesEnriched>[0]);
}

/** Détail d'une course pour le drawer régulateur (03-D). */
export async function getRideByIdAction(rideId: string) {
  if (!z.string().uuid().safeParse(rideId).success) return null;
  const { getRideByIdEnriched } = await import('../_lib/queries');
  return getRideByIdEnriched(rideId);
}

/** Audit log d'une course (drawer timeline — 03-D). */
export async function getRideAuditLogAction(rideId: string) {
  if (!z.string().uuid().safeParse(rideId).success) return [];
  const { getRideAuditLog } = await import('../_lib/queries');
  return getRideAuditLog(rideId);
}

/** Référentiel drivers actifs (modal assignation — 03-D). */
export async function listActiveDriversAction() {
  const { listActiveDrivers } = await import('../_lib/queries');
  return listActiveDrivers();
}

/** Référentiel vehicles actifs (modal assignation — 03-D). */
export async function listActiveVehiclesAction() {
  const { listActiveVehicles } = await import('../_lib/queries');
  return listActiveVehicles();
}

/** Référentiel donneurs d'ordres B2B actifs (picker saisie course — DEC-148). */
export async function listActiveOrderingPartiesAction() {
  const { listActiveOrderingParties } = await import('../_lib/queries');
  return listActiveOrderingParties();
}

/**
 * Phase 06.35 DEC-114 : pour le modal d'assignation, retourne le mode
 * de blocage org + la lookup conformité des chauffeurs/véhicules
 * actifs. Une seule round-trip serveur côté client.
 */
export async function getAssignmentComplianceContextAction() {
  const { getComplianceBlockingMode, getEntityComplianceLookup } =
    await import('../../../(admin)/admin/conformite/_lib/compliance-planning');
  const { listActiveDrivers, listActiveVehicles } = await import('../_lib/queries');
  const [drivers, vehicles, mode] = await Promise.all([
    listActiveDrivers(),
    listActiveVehicles(),
    getComplianceBlockingMode(),
  ]);
  const lookup = await getEntityComplianceLookup(
    drivers.map((d) => d.id),
    vehicles.map((v) => v.id),
  );
  return { mode, lookup };
}

/**
 * PATIENT-02 — préférences chauffeur du patient d'une course, pour décorer le
 * modal d'assignation (préféré mis en avant, évité = avertissement
 * franchissable). Retourne un lookup driverId → kind. Lecture seule, ne touche
 * NI le solveur NI `assignRideAction` : purement informatif.
 */
export async function getRideDriverPreferencesAction(
  rideId: string,
): Promise<{ byDriverId: Record<string, 'prefere' | 'evite'> }> {
  const empty = { byDriverId: {} as Record<string, 'prefere' | 'evite'> };
  if (!z.string().uuid().safeParse(rideId).success) return empty;
  const { createClient } = await import('@/lib/supabase/server');
  const { getDriverPreferenceLookupForPatient } =
    await import('../../patients/[id]/_lib/driver-preferences');
  const supabase = await createClient();
  const { data } = await supabase.from('rides').select('patient_id').eq('id', rideId).maybeSingle();
  const patientId = (data as { patient_id: string } | null)?.patient_id;
  if (!patientId) return empty;
  return { byDriverId: await getDriverPreferenceLookupForPatient(patientId) };
}

/**
 * Grille tarifaire active + jours fériés 974 pour le calcul pricing
 * côté client (Phase 05.5 — `computeCgssShortTrip` prend la grille en
 * paramètre, DEC-057). Consommé par RideDrawer via useQuery.
 */
export async function getActiveTariffGridAction() {
  const { getActiveTariffGrid, getHolidays974 } =
    await import('@/lib/pricing/get-active-tariff-grid');
  const [grid, holidays] = await Promise.all([getActiveTariffGrid(), getHolidays974()]);
  return { grid, holidays };
}
