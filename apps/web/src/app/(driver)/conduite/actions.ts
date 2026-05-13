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
 *   - RLS Postgres (rides_update policy Phase 2) autorise tout authentifié
 *     same-org à UPDATE rides — le filtre par chauffeur est applicatif ici
 *     (un chauffeur ne peut toucher qu'à SES courses). Defense in depth.
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
    .from('drivers' as never)
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
        'Votre compte chauffeur n\'est pas encore relié à un profil chauffeur. Contactez votre dirigeant.',
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
        'Démarrage impossible : la course n\'est pas en attente (statut : ' +
        currentRow.status +
        ').',
    };
  }

  const update = {
    status: 'en_cours',
    started_at: new Date().toISOString(),
    updated_by: ctx.userId,
  };
  const { error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data);
  if (error) return { error: 'Démarrage course impossible.' };

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
  .refine(
    (v) => v.payment_status !== 'encaisse' || !!v.payment_method,
    {
      message:
        'Une course encaissée doit indiquer le moyen de paiement (espèces, CB, chèque ou CGSS différé).',
      path: ['payment_method'],
    },
  );

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
        'Votre compte chauffeur n\'est pas encore relié à un profil chauffeur. Contactez votre dirigeant.',
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
        'Clôture impossible : la course n\'est pas en cours (statut : ' +
        currentRow.status +
        ').',
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

  const { error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data.rideId);
  if (error) return { error: 'Clôture course impossible.' };

  revalidatePath('/conduite');
  return { success: true, id: parsed.data.rideId };
}
