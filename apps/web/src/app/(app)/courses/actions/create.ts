'use server';

/**
 * Server Actions de création de course + gestion des brouillons (Phase 2 / Wave 2).
 *
 * Décisions :
 *   - D-05 : upsertRideDraft idempotent (auto-save 5 s + onBlur + onClose)
 *   - D-06 : createRideAction valide zod côté serveur, INSERT rides,
 *            optionnellement DELETE ride_draft, revalidatePath, pas de redirect
 *   - D-10 : audit_logs alimenté automatiquement par trigger PG sur rides —
 *            JAMAIS sur ride_draft (donnée transitoire RGPD)
 *   - DEC-016 : zéro logique métier dans les composants ; toute action vit ici.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { rideExpressInputSchema, rideDraftSchema } from '@tap/shared';
import { geocodeIfMissing } from '@/lib/geocoding/geocode-safety-net';
import { getAuthContext, type ActionState } from './_shared';

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

  // DEC-094 Phase 06.19 : filet serveur de géocodage si coords absentes.
  // Garantit que les courses créées sans picker (ex : API tierce, seed,
  // brouillon resté en mode texte libre) sont quand même éligibles à
  // l'optimisation `solveLocal`.
  const input = parsed.data.input;
  const [pickupCoords, dropoffCoords] = await Promise.all([
    geocodeIfMissing(
      input.pickup_address,
      input.pickup_lat,
      input.pickup_lng,
      input.pickup_citycode,
    ),
    geocodeIfMissing(
      input.dropoff_address,
      input.dropoff_lat,
      input.dropoff_lng,
      input.dropoff_citycode,
    ),
  ]);

  const { data: row, error } = await supabase
    .from('rides')
    .insert({
      organization_id,
      ...input,
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      pickup_citycode: pickupCoords.citycode,
      dropoff_lat: dropoffCoords.lat,
      dropoff_lng: dropoffCoords.lng,
      dropoff_citycode: dropoffCoords.citycode,
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

export async function deleteRideDraft(id: string): Promise<{ success: boolean; error?: string }> {
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
// LIST DRAFTS (Server Action wrapper pour useQuery — DraftQueue Wave 3/4)
// --------------------------------------------------------------------------

/**
 * Wrapper Server Action pour useQuery côté Client Component.
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
