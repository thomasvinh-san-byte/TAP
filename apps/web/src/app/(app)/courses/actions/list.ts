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

const listRidesParamsSchema = z.object({
  status: z.string().optional(),
  transport_mode: z.string().optional(),
  urgency: z.string().optional(),
  // Hotfix 04.7-bis : filtre date + pagination simple
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

/** RidesList Wave 4 (Phase 2) — version simple (sans jointures). */
export async function listRidesAction(params: z.infer<typeof listRidesParamsSchema> = {}) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) return [];
  const { listRides } = await import('../_lib/queries');
  return listRides(parsed.data as Parameters<typeof listRides>[0]);
}

/** Variante enrichie : courses + patient/driver/vehicle joints (03-D). */
export async function listRidesEnrichedAction(params: z.infer<typeof listRidesParamsSchema> = {}) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) return [];
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
