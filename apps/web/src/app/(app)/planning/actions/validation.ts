'use server';

/**
 * Server Action — validation du planning J+1 (Module 5.12 lot D).
 *
 * Pattern (CLAUDE.md §10) : zod → getAuthContext (rôle) → vérif idempotence →
 * INSERT validation + instantané (freeze du « prévu ») → notifications
 * best-effort → revalidatePath. RLS Postgres double-checke.
 *
 * Idempotence : l'index unique (organization_id, planning_date) garantit une
 * seule validation par jour. Re-valider ne re-fige rien et ne renotifie pas
 * (détection préalable + garde sur violation d'unicité 23505).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RIDE_CANCELLED_STATUSES } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { sendPushToDriver } from '@/lib/push/send';
import { notifyValidatedPlanningPatients } from '../_lib/notify-planning-validated';

const ROLES_REGULATION = ['regulateur', 'dirigeant'] as const;
const CANCELLED = new Set<string>(RIDE_CANCELLED_STATUSES);

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

interface DayRide {
  id: string;
  scheduled_at: string;
  status: string;
  driver_id: string | null;
  vehicle_id: string | null;
  patient_id: string | null;
}

/** Bornes du jour `date` en fuseau Réunion (UTC+4), en ISO avec offset. */
function reunionDayBounds(date: string): { start: string; endExclusive: string } {
  const start = `${date}T00:00:00+04:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const endExclusive = `${next.toISOString().slice(0, 10)}T00:00:00+04:00`;
  return { start, endExclusive };
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

  // Idempotence — déjà validé ?
  const existing = await ctx.supabase
    .from('planning_validations')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('planning_date', planningDate)
    .maybeSingle();
  if (existing.data) {
    return { success: true, alreadyValidated: true };
  }

  // Courses « prévues » fermes du jour (hors brouillon et hors annulées).
  const { start, endExclusive } = reunionDayBounds(planningDate);
  const ridesRes = await ctx.supabase
    .from('rides')
    .select('id, scheduled_at, status, driver_id, vehicle_id, patient_id')
    .gte('scheduled_at', start)
    .lt('scheduled_at', endExclusive)
    .neq('status', 'brouillon');
  if (ridesRes.error) return { error: 'Lecture du planning impossible.' };
  const rides = ((ridesRes.data as DayRide[] | null) ?? []).filter((r) => !CANCELLED.has(r.status));

  // INSERT validation (l'unicité tranche une éventuelle course concurrente).
  const insVal = await ctx.supabase
    .from('planning_validations')
    .insert({
      organization_id: ctx.organizationId,
      planning_date: planningDate,
      validated_by: ctx.userId,
    })
    .select('id')
    .single();
  if (insVal.error) {
    // 23505 = un autre régulateur vient de valider → idempotent, pas d'erreur.
    if (insVal.error.code === '23505') return { success: true, alreadyValidated: true };
    return { error: 'Validation impossible.' };
  }
  const validationId = (insVal.data as { id: string }).id;

  // Instantané du « prévu » (best-effort de robustesse : un échec du figeage
  // n'annule pas la validation déjà écrite, mais on le signale).
  if (rides.length > 0) {
    const snapshotRows = rides.map((r) => ({
      validation_id: validationId,
      organization_id: ctx.organizationId,
      ride_id: r.id,
      driver_id: r.driver_id,
      vehicle_id: r.vehicle_id,
      patient_id: r.patient_id,
      scheduled_at: r.scheduled_at,
      status: r.status,
    }));
    const insSnap = await ctx.supabase.from('planning_validation_rides').insert(snapshotRows);
    if (insSnap.error)
      console.error('[planning] figeage instantané échoué:', insSnap.error.message);
  }

  // Notifications best-effort — APRÈS commit. Aucun échec ne rollback.
  const driverIds = Array.from(
    new Set(rides.map((r) => r.driver_id).filter((x): x is string => Boolean(x))),
  );
  const countsByDriver = new Map<string, number>();
  for (const r of rides) {
    if (r.driver_id) countsByDriver.set(r.driver_id, (countsByDriver.get(r.driver_id) ?? 0) + 1);
  }
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
    rides.map((r) => r.id),
    ctx.organizationId,
  );

  // Compteurs de traçabilité (best-effort).
  await ctx.supabase
    .from('planning_validations')
    .update({ notified_drivers: driverIds.length, notified_patients: patientsNotified })
    .eq('id', validationId);

  revalidatePath('/planning');
  return { success: true, snapshot: rides.length };
}
