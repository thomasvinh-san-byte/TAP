'use server';

/**
 * Server Action — validation du planning J+1 (Module 5.12 lot D).
 *
 * Pattern (CLAUDE.md §10) : zod → getAuthContext (rôle) → RPC atomique →
 * notifications best-effort → revalidatePath. RLS Postgres double-checke.
 *
 * Atomicité : `validate_planning_day` (RPC SECURITY INVOKER) insère la
 * validation ET fige l'instantané des courses prévues dans une seule
 * transaction — plus de « validé sans instantané ». Idempotence portée par la
 * RPC (une validation par organisation et par jour). Les notifications (push /
 * SMS) restent HORS transaction, best-effort : un échec d'envoi ne remet jamais
 * en cause la validation déjà committée.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { sendPushToDriver } from '@/lib/push/send';
import { notifyValidatedPlanningPatients } from '../_lib/notify-planning-validated';

const ROLES_REGULATION = ['regulateur', 'dirigeant'] as const;

export type ValidatePlanningState = {
  error?: string;
  success?: boolean;
  /** Déjà validé (re-validation idempotente, aucune action). */
  alreadyValidated?: boolean;
  /** Nombre de courses figées dans l'instantané. */
  snapshot?: number;
};

const schema = z.object({
  planningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
});

interface ValidateRpcRow {
  validation_id: string;
  already_validated: boolean;
  snapshot_count: number;
}

export async function validatePlanningAction(
  args: z.infer<typeof schema>,
): Promise<ValidatePlanningState> {
  const parsed = schema.safeParse(args);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  const { planningDate } = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!ROLES_REGULATION.includes(ctx.role as (typeof ROLES_REGULATION)[number])) {
    return { error: 'Seul un régulateur ou un dirigeant peut valider le planning.' };
  }

  // Validation + figeage ATOMIQUES (RPC). L'idempotence et l'instantané sont
  // garantis en une transaction.
  const rpc = await ctx.supabase.rpc('validate_planning_day', {
    p_planning_date: planningDate,
  });
  if (rpc.error) return { error: 'Validation impossible.' };
  const result = ((rpc.data as ValidateRpcRow[] | null) ?? [])[0];
  if (!result) return { error: 'Validation impossible.' };
  if (result.already_validated) return { success: true, alreadyValidated: true };

  const validationId = result.validation_id;

  // Notifications best-effort — APRÈS commit, à partir de l'instantané FIGÉ
  // (source cohérente : ce qui a été validé, pas l'état courant susceptible
  // d'avoir bougé). Aucun échec ne remet en cause la validation.
  const snap = await ctx.supabase
    .from('planning_validation_rides')
    .select('ride_id, driver_id')
    .eq('validation_id', validationId);
  const frozen = (snap.data as { ride_id: string; driver_id: string | null }[] | null) ?? [];

  const countsByDriver = new Map<string, number>();
  for (const r of frozen) {
    if (r.driver_id) countsByDriver.set(r.driver_id, (countsByDriver.get(r.driver_id) ?? 0) + 1);
  }
  const driverIds = [...countsByDriver.keys()];

  await Promise.all(
    driverIds.map((driverId) =>
      sendPushToDriver(driverId, ctx.organizationId, {
        title: 'Planning validé',
        body: `Votre tournée du lendemain est confirmée (${countsByDriver.get(driverId) ?? 0} course${
          (countsByDriver.get(driverId) ?? 0) > 1 ? 's' : ''
        }).`,
        url: '/conduite',
      }),
    ),
  );
  const patientsNotified = await notifyValidatedPlanningPatients(
    frozen.map((r) => r.ride_id),
    ctx.organizationId,
  );

  // Compteurs de traçabilité (best-effort).
  await ctx.supabase
    .from('planning_validations')
    .update({ notified_drivers: driverIds.length, notified_patients: patientsNotified })
    .eq('id', validationId);

  revalidatePath('/planning');
  return { success: true, snapshot: result.snapshot_count };
}
