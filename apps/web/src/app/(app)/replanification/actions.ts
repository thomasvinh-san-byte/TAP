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
import { getAuthContext } from '@/lib/auth/get-auth-context';

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
    } as never)
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
    .update({ resolved_at: new Date().toISOString() } as never)
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
  for (const item of parsed.data) {
    const { data: current } = await ctx.supabase
      .from('rides')
      .select('status')
      .eq('id', item.rideId)
      .maybeSingle();
    const row = current as { status: string } | null;
    if (!row || !['validee', 'assignee'].includes(row.status)) continue;

    const upd = await ctx.supabase
      .from('rides')
      .update({
        driver_id: item.driverId,
        vehicle_id: null,
        status: 'assignee',
        updated_by: ctx.userId,
      } as never)
      .eq('id', item.rideId)
      .in('status', ['validee', 'assignee'])
      .select('id');
    if (!upd.error && upd.data && upd.data.length > 0) reassigned += 1;
  }

  if (reassigned === 0) {
    return { error: 'Aucune course réaffectée (statuts non éligibles ou droits insuffisants).' };
  }

  revalidatePath('/replanification');
  revalidatePath('/cockpit');
  revalidatePath('/courses');
  return { success: true, reassigned };
}
