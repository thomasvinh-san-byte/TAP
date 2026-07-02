'use server';

/**
 * Server Actions — replanification dynamique (régulation, DEC-160).
 *
 * Pattern (CLAUDE.md §10) : zod → getAuthContext (rôle) → vérif → UPDATE/INSERT
 * (DEC-041 row count check) → revalidatePath. RLS Postgres double-checke.
 *
 * - declareIncidentAction : déclare un incident (indisponibilité ou panne) sur
 *   un chauffeur (régulateur/dirigeant).
 * - resolveIncidentAction : marque un incident résolu (resolved_at).
 * - reassignRidesBatchAction : réaffecte en lot des courses au chauffeur choisi.
 *
 * Dette types : driver_incidents absente de types.gen.ts jusqu'au resync nightly
 * → `.from('driver_incidents' as never)` + payloads `as never` (DEC-155).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RIDE_MODIFIABLE_STATUSES, isModifiableStatus } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { sendPushToDriver } from '@/lib/push/send';
import { notifyReassignedPatients } from './_lib/notify-reaffectation';

const ROLES_REGULATION = ['regulateur', 'dirigeant'] as const;

export type ReplanActionState = {
  error?: string;
  success?: boolean;
  /** Nombre de courses effectivement réaffectées (batch). */
  reassigned?: number;
};

const declareIncidentSchema = z.object({
  driverId: z.string().uuid('Chauffeur requis'),
  type: z.enum(['panne_vehicule', 'indisponible']),
  nature: z.string().trim().max(500).optional(),
  lieu: z.string().trim().max(200).optional(),
});

export async function declareIncidentAction(
  args: z.infer<typeof declareIncidentSchema>,
): Promise<ReplanActionState> {
  const parsed = declareIncidentSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!ROLES_REGULATION.includes(ctx.role as (typeof ROLES_REGULATION)[number])) {
    return { error: 'Seul un régulateur ou un dirigeant peut déclarer un incident.' };
  }

  const ins = await ctx.supabase
    .from('driver_incidents')
    .insert({
      organization_id: ctx.organizationId,
      driver_id: parsed.data.driverId,
      type: parsed.data.type,
      nature: parsed.data.nature || null,
      lieu: parsed.data.lieu || null,
      created_by: ctx.userId,
    })
    .select('id');
  if (ins.error) return { error: "Déclaration de l'incident impossible." };
  if (!ins.data || ins.data.length === 0) {
    return { error: 'Déclaration refusée : droits insuffisants ou chauffeur absent.' };
  }

  revalidatePath('/replanification');
  revalidatePath('/cockpit');
  return { success: true };
}

const resolveIncidentSchema = z.string().uuid();

export async function resolveIncidentAction(incidentId: string): Promise<ReplanActionState> {
  const parsed = resolveIncidentSchema.safeParse(incidentId);
  if (!parsed.success) return { error: 'Identifiant incident invalide.' };
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!ROLES_REGULATION.includes(ctx.role as (typeof ROLES_REGULATION)[number])) {
    return { error: 'Seul un régulateur ou un dirigeant peut résoudre un incident.' };
  }

  const upd = await ctx.supabase
    .from('driver_incidents')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .is('resolved_at', null)
    .select('id');
  if (upd.error) return { error: 'Résolution impossible.' };
  if (!upd.data || upd.data.length === 0) {
    return { error: 'Incident déjà résolu ou introuvable.' };
  }

  revalidatePath('/replanification');
  revalidatePath('/cockpit');
  return { success: true };
}

const reassignBatchSchema = z
  .array(z.object({ rideId: z.string().uuid(), driverId: z.string().uuid() }))
  .min(1, 'Aucune course à réaffecter.')
  .max(100);

/**
 * Réaffecte en lot des courses au chauffeur choisi. Une course n'est réaffectée
 * que si elle est encore `validee`/`assignee` (jamais `en_cours`/`terminee` —
 * garde-fou : courses en cours intouchables). Le véhicule est réinitialisé
 * (le nouveau chauffeur re-sélectionne via le flux normal d'affectation).
 */
export async function reassignRidesBatchAction(
  items: z.infer<typeof reassignBatchSchema>,
): Promise<ReplanActionState> {
  const parsed = reassignBatchSchema.safeParse(items);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!ROLES_REGULATION.includes(ctx.role as (typeof ROLES_REGULATION)[number])) {
    return { error: 'Seul un régulateur ou un dirigeant peut réaffecter des courses.' };
  }

  let reassigned = 0;
  // DEC-161 : courses dont le chauffeur a EFFECTIVEMENT changé → SMS patient.
  // Idempotence : si l'action est rejouée avec le même chauffeur, driver_id ne
  // change pas → pas de course ici → pas de SMS en double.
  const changedRideIds: string[] = [];
  // DEC-167 : nb de courses réaffectées par NOUVEAU chauffeur (notification push).
  const reassignedByDriver = new Map<string, number>();
  for (const item of parsed.data) {
    const { data: current } = await ctx.supabase
      .from('rides')
      .select('status, driver_id')
      .eq('id', item.rideId)
      .maybeSingle();
    const row = current as { status: string; driver_id: string | null } | null;
    // DEC-178 : réaffectation seulement sur une course encore modifiable.
    if (!row || !isModifiableStatus(row.status)) continue;

    const upd = await ctx.supabase
      .from('rides')
      .update({
        driver_id: item.driverId,
        vehicle_id: null,
        status: 'assignee',
        updated_by: ctx.userId,
      })
      .eq('id', item.rideId)
      .in('status', [...RIDE_MODIFIABLE_STATUSES])
      .select('id');
    if (!upd.error && upd.data && upd.data.length > 0) {
      reassigned += 1;
      if (row.driver_id !== item.driverId) {
        changedRideIds.push(item.rideId);
        reassignedByDriver.set(item.driverId, (reassignedByDriver.get(item.driverId) ?? 0) + 1);
      }
    }
  }

  if (reassigned === 0) {
    return { error: 'Aucune course réaffectée (statuts non éligibles ou droits insuffisants).' };
  }

  // DEC-161 : SMS aux patients impactés — BEST-EFFORT, APRÈS commit. Un échec
  // d'envoi ne rollback JAMAIS la réaffectation (déjà persistée).
  await notifyReassignedPatients(changedRideIds, ctx.organizationId);

  // DEC-167 : notification push aux nouveaux chauffeurs (best-effort), 1 par
  // chauffeur (groupée) pour ne pas spammer.
  await Promise.all(
    [...reassignedByDriver.entries()].map(([driverId, count]) =>
      sendPushToDriver(driverId, ctx.organizationId, {
        title: 'Course réaffectée',
        body: `${count} course${count > 1 ? 's' : ''} vous ${count > 1 ? 'ont' : 'a'} été réaffectée${count > 1 ? 's' : ''}.`,
        url: '/conduite',
      }),
    ),
  );

  revalidatePath('/replanification');
  revalidatePath('/cockpit');
  revalidatePath('/courses');
  return { success: true, reassigned };
}
