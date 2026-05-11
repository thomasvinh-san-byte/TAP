'use server';

/**
 * Server Actions d'assignation (régulateur + dirigeant) — Phase 3 Passe 1, 03-B.
 *
 * Pattern (CLAUDE.md § 10) : zod → getAuthContext (rôle applicatif) → vérif
 * statut courant → UPDATE → revalidatePath. RLS Postgres double-checke
 * (defense in depth — DEC-005 Phase 2). Le trigger rides_audit_trigger
 * (Phase 2, inchangé) capture automatiquement les nouvelles colonnes via
 * to_jsonb(old/new) — colonnes étendues en migration 20260512000003.
 *
 * TODO(types) : packages/database/src/types.gen.ts n'a pas encore été
 * régénéré pour inclure les colonnes `driver_id`, `vehicle_id`, etc. —
 * sync-types.yml (cron 3h UTC) le fera. En attendant, les payloads d'UPDATE
 * sont castés `as never` ; le typage métier est porté par zod côté serveur.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext as getAuthContextWithRole } from '@/lib/auth/get-auth-context';
import { REGULATEUR_OR_DIRIGEANT, type ActionState } from './_shared';

const assignRideInputSchema = z.object({
  rideId: z.string().uuid(),
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
});

export async function assignRideAction(
  args: z.infer<typeof assignRideInputSchema>,
): Promise<ActionState> {
  const parsed = assignRideInputSchema.safeParse(args);
  if (!parsed.success) return { error: 'Saisie invalide.' };

  const ctx = await getAuthContextWithRole();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as 'regulateur' | 'dirigeant')) {
    return { error: 'Seul un régulateur ou un dirigeant peut assigner une course.' };
  }

  // Vérif statut courant : transition validee → assignee uniquement.
  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status')
    .eq('id', parsed.data.rideId)
    .single();
  const currentRow = current as { status: string } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  if (currentRow.status !== 'validee') {
    return {
      error:
        'Cette course n\'est plus assignable (statut : ' +
        currentRow.status +
        ').',
    };
  }

  const update = {
    status: 'assignee',
    driver_id: parsed.data.driverId,
    vehicle_id: parsed.data.vehicleId ?? null,
    updated_by: ctx.userId,
  };
  const { error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data.rideId);
  if (error) return { error: 'Assignation impossible.' };

  revalidatePath('/courses');
  return { success: true, id: parsed.data.rideId };
}

const unassignRideInputSchema = z.string().uuid();

export async function unassignRideAction(rideId: string): Promise<ActionState> {
  const parsed = unassignRideInputSchema.safeParse(rideId);
  if (!parsed.success) return { error: 'Identifiant course invalide.' };

  const ctx = await getAuthContextWithRole();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as 'regulateur' | 'dirigeant')) {
    return { error: 'Seul un régulateur ou un dirigeant peut désassigner une course.' };
  }

  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status')
    .eq('id', parsed.data)
    .single();
  const currentRow = current as { status: string } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  if (currentRow.status !== 'assignee') {
    return {
      error:
        'Désassignation impossible : la course n\'est pas en statut assignée (statut : ' +
        currentRow.status +
        ').',
    };
  }

  const update = {
    status: 'validee',
    driver_id: null,
    vehicle_id: null,
    updated_by: ctx.userId,
  };
  const { error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data);
  if (error) return { error: 'Désassignation impossible.' };

  revalidatePath('/courses');
  return { success: true, id: parsed.data };
}
