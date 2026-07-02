'use server';

/**
 * Server Actions — mode alerte météo / cyclone (DEC-170, CdG l.380-385).
 *
 * Pattern (CLAUDE.md §10) : zod → getAuthContext (rôle) → vérif → UPDATE/INSERT
 * (DEC-041 row count check) → revalidatePath. RLS Postgres double-checke.
 *
 * - setWeatherAlertAction : active / désactive le mode météo de l'org.
 * - cancelRidesBatchWeatherAction : annule en masse les courses d'une journée
 *   (statut dédié `annulee_meteo`), filtre zone optionnel, puis prévient
 *   patients (SMS best-effort) et chauffeurs (push best-effort).
 *
 * Dette types : weather_alerts absente de types.gen.ts + valeur d'enum
 * `annulee_meteo` récente → `.from('weather_alerts' as never)` et payloads
 * `as never` (DEC-155).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ACTIVE_RIDE_STATUSES, RIDE_MODIFIABLE_STATUSES } from '@tap/shared';
import { getAuthContext, type AuthContext } from '@/lib/auth/get-auth-context';
import { sendPushToDriver } from '@/lib/push/send';
import { notifyWeatherCancellation } from './_lib/notify-weather';

const ROLES_REGULATION = ['regulateur', 'dirigeant'] as const;

function isRegulation(role: string): boolean {
  return ROLES_REGULATION.includes(role as (typeof ROLES_REGULATION)[number]);
}

export type WeatherActionState = {
  error?: string;
  success?: boolean;
  /** Nombre de courses effectivement annulées (batch). */
  cancelled?: number;
};

const setAlertSchema = z.object({
  active: z.boolean(),
  motif: z.string().trim().min(1, 'Motif requis').max(200),
  zone: z.string().trim().max(120).optional(),
});

/** Active le mode météo : refuse si un épisode est déjà actif (un seul par org). */
async function activateAlert(
  ctx: AuthContext,
  motif: string,
  zone: string | undefined,
): Promise<WeatherActionState> {
  const ins = await ctx.supabase
    .from('weather_alerts')
    .insert({
      organization_id: ctx.organizationId,
      active: true,
      motif,
      zone: zone || null,
      activated_by: ctx.userId,
    })
    .select('id');
  if (ins.error) {
    // 23505 = violation de l'index unique partiel (mode déjà actif).
    if (ins.error.code === '23505') return { error: 'Le mode alerte météo est déjà actif.' };
    return { error: 'Activation du mode alerte météo impossible.' };
  }
  if (!ins.data || ins.data.length === 0) {
    return { error: 'Activation refusée : droits insuffisants.' };
  }
  return { success: true };
}

/** Désactive l'épisode actif de l'org (compare-and-set sur active = true). */
async function deactivateAlert(ctx: AuthContext): Promise<WeatherActionState> {
  const upd = await ctx.supabase
    .from('weather_alerts')
    .update({ active: false, deactivated_at: new Date().toISOString() })
    .eq('organization_id', ctx.organizationId)
    .eq('active', true)
    .select('id');
  if (upd.error) return { error: 'Désactivation du mode alerte météo impossible.' };
  if (!upd.data || upd.data.length === 0) {
    return { error: 'Aucun mode alerte météo actif à désactiver.' };
  }
  return { success: true };
}

export async function setWeatherAlertAction(
  args: z.infer<typeof setAlertSchema>,
): Promise<WeatherActionState> {
  const parsed = setAlertSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!isRegulation(ctx.role)) {
    return { error: 'Seul un régulateur ou un dirigeant peut piloter le mode alerte météo.' };
  }

  const result = parsed.data.active
    ? await activateAlert(ctx, parsed.data.motif, parsed.data.zone)
    : await deactivateAlert(ctx);

  if (result.success) {
    revalidatePath('/meteo');
    revalidatePath('/cockpit');
  }
  return result;
}

const cancelBatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).'),
  zone: z.string().trim().max(120).optional(),
});

type CancelledRide = {
  id: string;
  patient_id: string | null;
  driver_id: string | null;
  ride_group_id: string | null;
};

/** UPDATE en masse des courses du jour → `annulee_meteo` (compare-and-set statut). */
async function cancelRides(
  ctx: AuthContext,
  date: string,
  zone: string | undefined,
  motif: string,
): Promise<{ error?: string; rides?: CancelledRide[] }> {
  let query = ctx.supabase
    .from('rides')
    .update({ status: 'annulee_meteo', cancel_motif: motif, updated_by: ctx.userId })
    .gte('scheduled_at', `${date}T00:00:00`)
    .lte('scheduled_at', `${date}T23:59:59`)
    // DEC-178 : sources légales d'une annulation (machine à états centralisée).
    .in('status', [...RIDE_MODIFIABLE_STATUSES]);
  if (zone) query = query.ilike('pickup_city', `%${zone}%`);

  const upd = await query.select('id, patient_id, driver_id, ride_group_id');
  if (upd.error) return { error: 'Annulation des courses impossible.' };
  return { rides: (upd.data as unknown as CancelledRide[] | null) ?? [] };
}

/**
 * Cohérence des demandes groupées impactées (DEC-175, fix B3) — BEST-EFFORT.
 * Un `ride_group` `acceptee` dont TOUTES les courses sont désormais annulées
 * passe `annulee` ; s'il reste ≥1 course active (ex. hors zone météo) il reste
 * `acceptee`. Anti-N+1 : une requête d'agrégation pour les survivants, un seul
 * UPDATE groupé. Un échec ne rollback JAMAIS l'annulation (déjà committée).
 */
async function reconcileWeatherGroups(ctx: AuthContext, rides: CancelledRide[]): Promise<void> {
  try {
    const groupIds = Array.from(
      new Set(rides.map((r) => r.ride_group_id).filter((x): x is string => Boolean(x))),
    );
    if (groupIds.length === 0) return; // no-op : aucune course groupée touchée.

    const survRes = await ctx.supabase
      .from('rides')
      .select('ride_group_id')
      .in('ride_group_id', groupIds)
      .in('status', [...ACTIVE_RIDE_STATUSES]);
    if (survRes.error) {
      console.error('[meteo groups] lecture survivants échouée:', survRes.error.message);
      return;
    }
    const withSurvivors = new Set(
      ((survRes.data as { ride_group_id: string | null }[] | null) ?? [])
        .map((r) => r.ride_group_id)
        .filter((x): x is string => Boolean(x)),
    );
    const fullyCancelled = groupIds.filter((id) => !withSurvivors.has(id));
    if (fullyCancelled.length === 0) return; // tous les groupes ont des survivants.

    const upd = await ctx.supabase
      .from('ride_groups')
      .update({ status: 'annulee' })
      .in('id', fullyCancelled)
      .eq('status', 'acceptee'); // ne touche que les groupes actifs.
    if (upd.error) {
      console.error('[meteo groups] mise à jour des groupes échouée:', upd.error.message);
    }
  } catch (err) {
    console.error('[meteo groups] échec global (best-effort, annulation conservée):', err);
  }
}

/** Notifie chauffeurs impactés (push groupé par chauffeur), best-effort. */
async function notifyDrivers(
  ctx: AuthContext,
  rides: CancelledRide[],
  date: string,
): Promise<void> {
  const byDriver = new Map<string, number>();
  for (const r of rides) {
    if (r.driver_id) byDriver.set(r.driver_id, (byDriver.get(r.driver_id) ?? 0) + 1);
  }
  await Promise.all(
    [...byDriver.entries()].map(([driverId, count]) =>
      sendPushToDriver(driverId, ctx.organizationId, {
        title: 'Courses annulées (alerte météo)',
        body: `${count} course${count > 1 ? 's' : ''} du ${date} annulée${count > 1 ? 's' : ''} (alerte météo).`,
        url: '/conduite',
      }),
    ),
  );
}

export async function cancelRidesBatchWeatherAction(
  args: z.infer<typeof cancelBatchSchema>,
): Promise<WeatherActionState> {
  const parsed = cancelBatchSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!isRegulation(ctx.role)) {
    return { error: 'Seul un régulateur ou un dirigeant peut annuler les courses pour météo.' };
  }

  const motif = parsed.data.zone ? `Alerte météo — ${parsed.data.zone}` : 'Alerte météo';
  const { error, rides } = await cancelRides(ctx, parsed.data.date, parsed.data.zone, motif);
  if (error) return { error };
  if (!rides || rides.length === 0) {
    return { error: 'Aucune course éligible à annuler (déjà annulées, en cours ou terminées).' };
  }

  // Best-effort APRÈS commit : un échec de notification ne rollback rien.
  await notifyWeatherCancellation(
    rides.map((r) => r.id),
    ctx.organizationId,
  );
  await notifyDrivers(ctx, rides, parsed.data.date);
  // DEC-175 (B3) : cohérence des demandes groupées entièrement annulées.
  await reconcileWeatherGroups(ctx, rides);

  revalidatePath('/meteo');
  revalidatePath('/cockpit');
  revalidatePath('/courses');
  revalidatePath('/courses/demandes-groupees');
  return { success: true, cancelled: rides.length };
}
