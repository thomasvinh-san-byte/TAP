'use server';

/**
 * Server Actions chauffeur — démarrer / clôturer une course.
 * Phase 3 Passe 1, sous-bloc 03-B. Consommé par l'écran /conduite (03-E).
 *
 * Pattern (CLAUDE.md § 10) :
 *   zod → getAuthContext (rôle chauffeur) → vérif jointure driver_id ↔
 *   profile_id → vérif statut courant → UPDATE → revalidatePath.
 *
 * Sécurité :
 *   - RLS Postgres : policy rides_update_chauffeur_own_rides (migration
 *     20260516000003) autorise UPDATE si role=chauffeur ET driver_id ∈ mes
 *     drivers (profile_id = auth.uid()). USING + WITH CHECK identiques
 *     empêchent transfert via UPDATE driver_id.
 *   - Pattern DEC-041 (row count check) : on .select('id') sur l'UPDATE et
 *     on vérifie data.length > 0 — sinon RLS a silencieusement rejeté
 *     l'UPDATE et on retourne erreur explicite au lieu d'un faux success.
 *   - Vérif statut courant avant UPDATE (« on n'écrase pas une course
 *     déjà clôturée par mégarde »).
 *   - Trigger rides_audit_trigger Phase 2 capture toutes les transitions
 *     dans audit_logs (action ride.update).
 *
 * TODO(types) : packages/database/src/types.gen.ts pas encore régénéré pour
 * inclure `drivers`, `payment_*`, `started_at`, etc. — sync-types.yml (cron
 * 3h UTC) le fera. Casts ciblés `as never` / `as { … }` jusqu'à régénération.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext, type AuthContext } from '@/lib/auth/get-auth-context';

export type ActionState = {
  error?: string;
  success?: boolean;
  id?: string;
};

const paymentMethodSchema = z.enum(['cash', 'cb', 'cheque', 'cgss_differe']);
const paymentStatusSchema = z.enum(['non_concerne', 'a_encaisser', 'encaisse']);

// --------------------------------------------------------------------------
// Helper : récupérer le driver_id du chauffeur authentifié (jointure
// drivers.profile_id ↔ auth.users.id). Renvoie null si l'utilisateur n'a
// pas de driver associé (ex : chauffeur fraîchement créé en Auth mais pas
// encore lié dans drivers).
// --------------------------------------------------------------------------

type DriverIdRow = { id: string };

async function getMyDriverId(ctx: AuthContext): Promise<string | null> {
  // TODO(types) : `drivers` absent de types.gen.ts jusqu'à régénération
  // nightly (sync-types.yml cron 3h UTC). Cast ciblé du nom de table en
  // attendant — Supabase JS tolère les tables inconnues à l'exécution.
  const { data } = await ctx.supabase
    .from('drivers')
    .select('id')
    .eq('profile_id', ctx.userId)
    .eq('organization_id', ctx.organizationId)
    .eq('archive', false)
    .maybeSingle();
  return ((data as DriverIdRow | null) ?? null)?.id ?? null;
}

// --------------------------------------------------------------------------
// startRideAction — assignee → en_cours
// --------------------------------------------------------------------------

const startRideInputSchema = z.string().uuid();

export async function startRideAction(rideId: string): Promise<ActionState> {
  const parsed = startRideInputSchema.safeParse(rideId);
  if (!parsed.success) return { error: 'Identifiant course invalide.' };

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (ctx.role !== 'chauffeur') {
    return { error: 'Seul un chauffeur peut démarrer une course.' };
  }

  const myDriverId = await getMyDriverId(ctx);
  if (!myDriverId) {
    return {
      error:
        "Votre compte chauffeur n'est pas encore relié à un profil chauffeur. Contactez votre dirigeant.",
    };
  }

  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status, driver_id')
    .eq('id', parsed.data)
    .single();
  const currentRow = current as { status: string; driver_id: string | null } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  if (currentRow.driver_id !== myDriverId) {
    return { error: 'Cette course ne vous est pas affectée.' };
  }
  if (currentRow.status !== 'assignee') {
    return {
      error:
        "Démarrage impossible : la course n'est pas en attente (statut : " +
        currentRow.status +
        ').',
    };
  }

  const update = {
    status: 'en_cours',
    started_at: new Date().toISOString(),
    updated_by: ctx.userId,
  };
  const { data: updated, error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data)
    .select('id');
  if (error) return { error: 'Démarrage course impossible.' };
  if (!updated || updated.length === 0) {
    return {
      error: 'Course non modifiée : vérifiez que vous êtes bien le chauffeur assigné.',
    };
  }

  revalidatePath('/conduite');
  return { success: true, id: parsed.data };
}

// --------------------------------------------------------------------------
// endRideAction — en_cours → terminee + tarif + paiement
// --------------------------------------------------------------------------
//
// Cohérence métier zod (defense in depth vs check Postgres
// rides_payment_encaisse_complet) : encaisse ⇒ payment_method requis.

const endRideInputSchema = z
  .object({
    rideId: z.string().uuid(),
    tarif_amount_eur: z.number().nonnegative(),
    payment_status: paymentStatusSchema,
    payment_method: paymentMethodSchema.optional(),
  })
  .refine((v) => v.payment_status !== 'encaisse' || !!v.payment_method, {
    message:
      'Une course encaissée doit indiquer le moyen de paiement (espèces, CB, chèque ou CGSS différé).',
    path: ['payment_method'],
  });

export async function endRideAction(
  args: z.infer<typeof endRideInputSchema>,
): Promise<ActionState> {
  const parsed = endRideInputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Clôture invalide.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (ctx.role !== 'chauffeur') {
    return { error: 'Seul un chauffeur peut clôturer une course.' };
  }

  const myDriverId = await getMyDriverId(ctx);
  if (!myDriverId) {
    return {
      error:
        "Votre compte chauffeur n'est pas encore relié à un profil chauffeur. Contactez votre dirigeant.",
    };
  }

  const { data: current } = await ctx.supabase
    .from('rides')
    .select('status, driver_id')
    .eq('id', parsed.data.rideId)
    .single();
  const currentRow = current as { status: string; driver_id: string | null } | null;
  if (!currentRow) return { error: 'Course introuvable.' };
  if (currentRow.driver_id !== myDriverId) {
    return { error: 'Cette course ne vous est pas affectée.' };
  }
  if (currentRow.status !== 'en_cours') {
    return {
      error:
        "Clôture impossible : la course n'est pas en cours (statut : " + currentRow.status + ').',
    };
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: 'terminee',
    ended_at: nowIso,
    tarif_amount_eur: parsed.data.tarif_amount_eur,
    tarif_source: 'manuel',
    payment_status: parsed.data.payment_status,
    updated_by: ctx.userId,
  };
  if (parsed.data.payment_method !== undefined) {
    update.payment_method = parsed.data.payment_method;
  }
  if (parsed.data.payment_status === 'encaisse') {
    update.payment_received_at = nowIso;
  }

  const { data: updated, error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data.rideId)
    .select('id');
  if (error) return { error: 'Clôture course impossible.' };
  if (!updated || updated.length === 0) {
    return {
      error: 'Course non modifiée : vérifiez que vous êtes bien le chauffeur assigné.',
    };
  }

  revalidatePath('/conduite');
  return { success: true, id: parsed.data.rideId };
}

// --------------------------------------------------------------------------
// reportBreakdownAction — signalement panne véhicule (DEC-160, CdG l.364-365)
// Crée un driver_incident type 'panne_vehicule' sur le driver du chauffeur
// authentifié. La régulation est alertée et peut réaffecter les courses.
// --------------------------------------------------------------------------

const reportBreakdownSchema = z.object({
  nature: z.string().trim().min(1, 'Décrivez la panne.').max(500),
  lieu: z.string().trim().max(200).optional(),
});

export async function reportBreakdownAction(
  args: z.infer<typeof reportBreakdownSchema>,
): Promise<ActionState> {
  const parsed = reportBreakdownSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (ctx.role !== 'chauffeur') {
    return { error: 'Seul un chauffeur peut signaler une panne.' };
  }
  const myDriverId = await getMyDriverId(ctx);
  if (!myDriverId) {
    return { error: "Votre compte n'est pas relié à un profil chauffeur." };
  }

  const ins = await ctx.supabase
    .from('driver_incidents')
    .insert({
      organization_id: ctx.organizationId,
      driver_id: myDriverId,
      type: 'panne_vehicule',
      nature: parsed.data.nature,
      lieu: parsed.data.lieu || null,
      created_by: ctx.userId,
    } as never)
    .select('id');
  if (ins.error) return { error: 'Signalement impossible. Réessayez.' };
  if (!ins.data || ins.data.length === 0) {
    return { error: 'Signalement refusé. Contactez la régulation.' };
  }

  revalidatePath('/conduite');
  return { success: true };
}
