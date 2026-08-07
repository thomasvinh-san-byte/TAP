'use server';

/**
 * Server Actions d'assignation (régulateur + dirigeant) — Phase 3 Passe 1, 03-B.
 *
 * Pattern (CLAUDE.md § 10) : zod → getAuthContext (rôle applicatif) → vérif
 * statut courant → UPDATE → revalidatePath. RLS Postgres double-checke
 * (defense in depth — DEC-005 Phase 2). Le trigger rides_audit_trigger
 * (Phase 2, inchangé) capture automatiquement les nouvelles colonnes via
 * to_jsonb(old/new) — colonnes étendues en migration 20260512000003.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canTransition, isModifiableStatus } from '@tap/shared';
import { getAuthContext as getAuthContextWithRole } from '@/lib/auth/get-auth-context';
import { sendPushToDriver } from '@/lib/push/send';
import { checkAssignmentCompliance } from '../../../(admin)/admin/conformite/_lib/compliance-planning';
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
    return { error: 'Seul un régulateur ou un dirigeant peut affecter une course.' };
  }

  // Vérif statut courant : transition validee → assignee uniquement.
  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status, scheduled_at')
    .eq('id', parsed.data.rideId)
    .single();
  const currentRow = current as { status: string; scheduled_at: string } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  // DEC-178 : transition validee → assignee via la machine à états centralisée.
  if (!canTransition(currentRow.status, 'assignee')) {
    return {
      error: "Cette course n'est plus assignable (statut : " + currentRow.status + ').',
    };
  }

  // Phase 06.35 DEC-114 : revérif conformité serveur (defense in depth).
  // Mode 'warn' = toujours accepté ; mode 'block' = refus si entité non
  // conforme. Le client peut sauter sa propre vérif en mode 'warn'.
  const complianceCheck = await checkAssignmentCompliance(
    parsed.data.driverId,
    parsed.data.vehicleId ?? null,
  );
  if (!complianceCheck.allowed) {
    return { error: complianceCheck.reason };
  }

  const update = {
    status: 'assignee' as const,
    driver_id: parsed.data.driverId,
    vehicle_id: parsed.data.vehicleId ?? null,
    updated_by: ctx.userId,
  };
  // DEC-041 row count check + DEC-168 compare-and-set : `.eq('status','validee')`
  // dans le WHERE rend l'affectation atomique (anti-TOCTOU). Si un autre
  // régulateur vient d'affecter la course, le statut n'est plus `validee` →
  // 0 ligne → refus explicite (pas d'écrasement silencieux).
  const upd = await ctx.supabase
    .from('rides')
    .update(update)
    .eq('id', parsed.data.rideId)
    .eq('status', 'validee')
    .select('id');
  if (upd.error) return { error: 'Assignation impossible.' };
  if (!upd.data || upd.data.length === 0) {
    return {
      error: 'Cette course vient d’être affectée par un autre régulateur. Actualisez la liste.',
    };
  }

  // DEC-167 : notification push au chauffeur (best-effort — n'échoue jamais).
  const heure = new Date(currentRow.scheduled_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Reunion',
  });
  await sendPushToDriver(parsed.data.driverId, ctx.organizationId, {
    title: 'Nouvelle course',
    body: `Une course vous a été affectée à ${heure}.`,
    url: `/conduite/${parsed.data.rideId}`,
  });

  revalidatePath('/courses');
  // L'affectation change ce que montre le cockpit (tournée + alerte non affectée).
  revalidatePath('/cockpit');
  return { success: true, id: parsed.data.rideId };
}

const assignVehicleInputSchema = z.object({
  rideId: z.string().uuid(),
  vehicleId: z.string().uuid(),
});

/**
 * Affecte uniquement le véhicule suggéré à une course (D-03 / D-16 / Phase 06.7).
 *
 * Contrairement à assignRideAction, cette action :
 *   - N'écrit QUE vehicle_id (pas status, pas driver_id).
 *   - Accepte les statuts validee et assignee (on ne change que le véhicule).
 *   - Le trigger rides_audit_trigger capture automatiquement la modification.
 */
export async function assignVehicleAction(
  args: z.infer<typeof assignVehicleInputSchema>,
): Promise<ActionState> {
  const parsed = assignVehicleInputSchema.safeParse(args);
  if (!parsed.success) return { error: 'Saisie invalide.' };

  const ctx = await getAuthContextWithRole();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as 'regulateur' | 'dirigeant')) {
    return { error: 'Seul un régulateur ou un dirigeant peut affecter un véhicule.' };
  }

  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status')
    .eq('id', parsed.data.rideId)
    .single();
  const currentRow = current as { status: string } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  // DEC-178 : un véhicule ne se (ré)affecte que sur une course encore modifiable.
  if (!isModifiableStatus(currentRow.status)) {
    return {
      error: 'Affectation de véhicule impossible : statut ' + currentRow.status + '.',
    };
  }

  const update = {
    vehicle_id: parsed.data.vehicleId,
    updated_by: ctx.userId,
  };
  // DEC-041 row count check.
  const upd = await ctx.supabase
    .from('rides')
    .update(update)
    .eq('id', parsed.data.rideId)
    .select('id');
  if (upd.error) return { error: 'Affectation du véhicule impossible.' };
  if (!upd.data || upd.data.length === 0) {
    return { error: 'Affectation refusée : droits insuffisants ou course absente.' };
  }

  revalidatePath('/courses');
  revalidatePath('/cockpit');
  return { success: true, id: parsed.data.rideId };
}

const unassignRideInputSchema = z.string().uuid();

export async function unassignRideAction(rideId: string): Promise<ActionState> {
  const parsed = unassignRideInputSchema.safeParse(rideId);
  if (!parsed.success) return { error: 'Identifiant course invalide.' };

  const ctx = await getAuthContextWithRole();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as 'regulateur' | 'dirigeant')) {
    return { error: 'Seul un régulateur ou un dirigeant peut désaffecter une course.' };
  }

  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status')
    .eq('id', parsed.data)
    .single();
  const currentRow = current as { status: string } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  // DEC-178 : seule arête de désescalade vers `validee` (assignee → validee).
  // Source unique explicite (brouillon → validee est l'acceptation de groupe,
  // sémantiquement distincte) ; atomicité via `.eq('status','assignee')`.
  if (!canTransition(currentRow.status, 'validee') || currentRow.status === 'brouillon') {
    return {
      error:
        "Désaffectation impossible : la course n'est pas en statut affectée (statut : " +
        currentRow.status +
        ').',
    };
  }

  const update = {
    status: 'validee' as const,
    driver_id: null,
    vehicle_id: null,
    updated_by: ctx.userId,
  };
  // DEC-041 row count check + DEC-168 compare-and-set (`.eq('status','assignee')`).
  const upd = await ctx.supabase
    .from('rides')
    .update(update)
    .eq('id', parsed.data)
    .eq('status', 'assignee')
    .select('id');
  if (upd.error) return { error: 'Désassignation impossible.' };
  if (!upd.data || upd.data.length === 0) {
    return {
      error: 'Le statut de cette course a changé entre-temps. Actualisez la liste.',
    };
  }

  revalidatePath('/courses');
  return { success: true, id: parsed.data };
}
