'use server';

/**
 * Server Actions du module saisie express course (Phase 2 / Wave 2).
 *
 * Pattern (CLAUDE.md § 10) : Validation zod → Authz (RLS Postgres) →
 * Transaction → Audit log (trigger Postgres rides_audit_trigger) → Réponse.
 *
 * Décisions appliquées (cf. .planning/phases/02-saisie-express-course/02-CONTEXT.md) :
 *   - D-05 : upsertRideDraft idempotent (auto-save 5 s + onBlur + onClose)
 *   - D-06 : createRideAction valide zod côté serveur, INSERT rides, optionnellement
 *            DELETE ride_draft, revalidatePath(/courses) + (/cockpit), pas de redirect
 *            (le modal se ferme côté client, toast Sonner Wave 3)
 *   - D-10 : audit_logs alimenté automatiquement par trigger PG sur rides — JAMAIS
 *            sur ride_draft (donnée transitoire RGPD)
 *   - DEC-016 : zéro logique métier dans les composants ; toute action vit ici.
 *
 * Notes sécurité :
 *   - Le check de rôle (regulateur/dirigeant) est délégué à RLS Postgres
 *     (policy rides_insert_regulateur — Wave 1) — DRY, source de vérité serveur.
 *   - Le `service_role` n'est JAMAIS utilisé ici.
 *   - Aucun import direct `@supabase/*` ; uniquement le wrapper `@/lib/supabase/server`.
 *   - Tous les messages d'erreur sont reformulés en français (CLAUDE.md § 5).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { rideExpressInputSchema, rideDraftSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext as getAuthContextWithRole } from '@/lib/auth/get-auth-context';

export type ActionState = {
  error?: string;
  success?: boolean;
  id?: string;
};

// --------------------------------------------------------------------------
// Helpers internes
// --------------------------------------------------------------------------

/**
 * Auth + profile org_id en une étape. Retourne `null` si non authentifié
 * ou profil absent — l'action appelante doit short-circuit avec une erreur FR.
 */
async function getAuthContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return null;
  return { supabase, user, organization_id: profile.organization_id };
}

// --------------------------------------------------------------------------
// CREATE RIDE (D-06)
// --------------------------------------------------------------------------

const createRideInputSchema = z.object({
  input: rideExpressInputSchema,
  fromDraftId: z.string().uuid().optional(),
});

export async function createRideAction(
  args: z.infer<typeof createRideInputSchema>,
): Promise<ActionState> {
  const parsed = createRideInputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  const { supabase, user, organization_id } = ctx;

  const { data: row, error } = await supabase
    .from('rides')
    .insert({
      organization_id,
      ...parsed.data.input,
      created_by: user.id,
      updated_by: user.id,
    } as never)
    .select('id')
    .single();
  const insertedRow = row as { id: string } | null;
  if (error || !insertedRow) {
    return { error: 'Création course impossible.' };
  }

  // Si la saisie venait d'un brouillon : DELETE (RLS auto-filtre author_id).
  if (parsed.data.fromDraftId) {
    await supabase.from('ride_draft').delete().eq('id', parsed.data.fromDraftId);
  }

  revalidatePath('/courses');
  revalidatePath('/cockpit');
  return { success: true, id: insertedRow.id };
}

// --------------------------------------------------------------------------
// UPSERT DRAFT (D-05 — idempotent auto-save)
// --------------------------------------------------------------------------

const upsertDraftInputSchema = z.object({
  id: z.string().uuid().optional(),
  payload: rideDraftSchema,
  patient_id: z.string().uuid().optional(),
});

export async function upsertRideDraft(
  args: z.infer<typeof upsertDraftInputSchema>,
): Promise<{ id: string } | { error: string }> {
  const parsed = upsertDraftInputSchema.safeParse(args);
  if (!parsed.success) return { error: 'Brouillon invalide.' };

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée.' };
  const { supabase, user, organization_id } = ctx;

  const row = {
    ...(parsed.data.id ? { id: parsed.data.id } : {}),
    organization_id,
    author_id: user.id,
    payload: parsed.data.payload,
    patient_id: parsed.data.patient_id ?? null,
  };

  const { data, error } = await supabase
    .from('ride_draft')
    .upsert(row as never, { onConflict: 'id' })
    .select('id')
    .single();
  const savedRow = data as { id: string } | null;
  if (error || !savedRow) return { error: 'Sauvegarde impossible.' };
  return { id: savedRow.id };
}

// --------------------------------------------------------------------------
// DELETE DRAFT
// --------------------------------------------------------------------------

export async function deleteRideDraft(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'Identifiant brouillon invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: 'Session expirée.' };

  const { error } = await ctx.supabase.from('ride_draft').delete().eq('id', id);
  if (error) return { success: false, error: 'Suppression brouillon impossible.' };
  return { success: true };
}

// --------------------------------------------------------------------------
// LIST DRAFTS (Server Action wrapper pour consommation client useQuery)
// --------------------------------------------------------------------------

/**
 * Wrapper Server Action pour useQuery côté Client Component (DraftQueue Wave 3/4).
 * L'usage RSC pur passe par `_lib/queries.ts` (`listDrafts`).
 * RLS s'occupe de filtrer `author_id = auth.uid()` automatiquement.
 */
export async function listDraftsAction() {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from('ride_draft')
    .select('id, payload, patient_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

// --------------------------------------------------------------------------
// LIST RIDES (Server Action wrapper pour useQuery — RidesList Wave 4)
// --------------------------------------------------------------------------

const listRidesParamsSchema = z.object({
  status: z.string().optional(),
  transport_mode: z.string().optional(),
  urgency: z.string().optional(),
});

/**
 * Wrapper Server Action pour useQuery côté Client Component (RidesList Wave 4).
 * L'usage RSC pur passe par `_lib/queries.ts` (`listRides`). RLS Postgres
 * filtre automatiquement par organization_id + role.
 *
 * Pour éviter d'importer `next/headers` côté client, ce wrapper réimporte
 * la query RSC dynamiquement (Server Action ⇒ exécution serveur garantie).
 */
export async function listRidesAction(
  params: z.infer<typeof listRidesParamsSchema> = {},
) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) return [];
  const { listRides } = await import('./_lib/queries');
  return listRides(
    parsed.data as Parameters<typeof listRides>[0],
  );
}

/**
 * Variante enrichie : courses + patient/driver/vehicle joints (03-D).
 * Consommée par RidesList côté client via useQuery.
 */
export async function listRidesEnrichedAction(
  params: z.infer<typeof listRidesParamsSchema> = {},
) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) return [];
  const { listRidesEnriched } = await import('./_lib/queries');
  return listRidesEnriched(
    parsed.data as Parameters<typeof listRidesEnriched>[0],
  );
}

/**
 * Détail d'une course pour le drawer régulateur (03-D).
 */
export async function getRideByIdAction(rideId: string) {
  if (!z.string().uuid().safeParse(rideId).success) return null;
  const { getRideByIdEnriched } = await import('./_lib/queries');
  return getRideByIdEnriched(rideId);
}

/** Audit log d'une course (drawer timeline — 03-D). */
export async function getRideAuditLogAction(rideId: string) {
  if (!z.string().uuid().safeParse(rideId).success) return [];
  const { getRideAuditLog } = await import('./_lib/queries');
  return getRideAuditLog(rideId);
}

/** Référentiel drivers/vehicles actifs (modal assignation — 03-D). */
export async function listActiveDriversAction() {
  const { listActiveDrivers } = await import('./_lib/queries');
  return listActiveDrivers();
}
export async function listActiveVehiclesAction() {
  const { listActiveVehicles } = await import('./_lib/queries');
  return listActiveVehicles();
}

// --------------------------------------------------------------------------
// ASSIGNATION + PAIEMENT (régulateur + dirigeant) — Phase 3 Passe 1, 03-B
// --------------------------------------------------------------------------
//
// Pattern (CLAUDE.md § 10) : zod → getAuthContext (rôle applicatif) → vérif
// statut courant → UPDATE → revalidatePath. RLS Postgres double-checke
// (defense in depth — DEC-005 Phase 2). Le trigger rides_audit_trigger
// (Phase 2, inchangé) capture automatiquement les nouvelles colonnes via
// to_jsonb(old/new) — colonnes étendues en migration 20260512000003.
//
// TODO(types) : packages/database/src/types.gen.ts n'a pas encore été
// régénéré pour inclure les colonnes `driver_id`, `vehicle_id`,
// `payment_status`, etc. — sync-types.yml (cron 3h UTC) le fera. En
// attendant, les payloads d'UPDATE sont castés `as never` (pattern déjà
// utilisé pour createRideAction) ; le reste du typage métier est porté
// par zod côté serveur. À retirer dès que le PR auto de sync-types passe.

const REGULATEUR_OR_DIRIGEANT = ['regulateur', 'dirigeant'] as const;

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

// Cohérence métier zod (defense in depth vs check Postgres
// rides_payment_encaisse_complet) : encaisse ⇒ payment_method requis.
const paymentMethodSchema = z.enum(['cash', 'cb', 'cheque', 'cgss_differe']);
const paymentStatusSchema = z.enum(['non_concerne', 'a_encaisser', 'encaisse']);
const tarifSourceSchema = z.enum(['manuel', 'cgss_auto']);

const updateRidePaymentInputSchema = z
  .object({
    rideId: z.string().uuid(),
    tarif_amount_eur: z.number().nonnegative().optional(),
    tarif_source: tarifSourceSchema.optional(),
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

export async function updateRidePaymentAction(
  args: z.infer<typeof updateRidePaymentInputSchema>,
): Promise<ActionState> {
  const parsed = updateRidePaymentInputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Paiement invalide.' };
  }

  const ctx = await getAuthContextWithRole();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as 'regulateur' | 'dirigeant')) {
    return { error: 'Seul un régulateur ou un dirigeant peut modifier un paiement.' };
  }

  // Pas de transition de statut ride ici — on ne touche qu'aux champs paiement.
  // payment_received_at posé à now() UNIQUEMENT à la bascule vers `encaisse`
  // (sinon laissé tel quel : éviter d'écraser la date d'origine d'encaissement).
  const update: Record<string, unknown> = {
    payment_status: parsed.data.payment_status,
    updated_by: ctx.userId,
  };
  if (parsed.data.tarif_amount_eur !== undefined) {
    update.tarif_amount_eur = parsed.data.tarif_amount_eur;
  }
  if (parsed.data.tarif_source !== undefined) {
    update.tarif_source = parsed.data.tarif_source;
  }
  if (parsed.data.payment_method !== undefined) {
    update.payment_method = parsed.data.payment_method;
  }
  if (parsed.data.payment_status === 'encaisse') {
    update.payment_received_at = new Date().toISOString();
  }

  const { error } = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data.rideId);
  if (error) return { error: 'Mise à jour paiement impossible.' };

  revalidatePath('/courses');
  return { success: true, id: parsed.data.rideId };
}
