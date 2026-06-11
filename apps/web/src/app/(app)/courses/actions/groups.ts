'use server';

/**
 * Server Actions — demande groupée B2B (DEC-158, extension 2/3).
 *
 * Workflow porté par le GROUPE (pas par ride_status) :
 *   - création : ride_group `en_attente` + N courses enfants `brouillon`
 *     (pas fermes → invisibles cockpit/optimisation/caisse qui ciblent
 *      validee/terminee).
 *   - acceptation : group `acceptee` + courses brouillon → validee.
 *   - refus : group `refusee` + motif + courses → annulee_regulateur.
 *
 * Sécurité : RLS Postgres (ride_groups_*_regulateur, rides_*_regulateur) gate
 * les rôles ; les courses portent `ordering_party_id` → tarifées via la grille
 * B2B (DEC-157) à l'acceptation, sans recode pricing.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { rideGroupRequestSchema, rideGroupRefusalSchema } from '@tap/shared';
import { geocodeIfMissing } from '@/lib/geocoding/geocode-safety-net';
import { getAuthContext, type ActionState } from './_shared';

export async function createRideGroupAction(
  args: z.infer<typeof rideGroupRequestSchema>,
): Promise<ActionState> {
  const parsed = rideGroupRequestSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Demande groupée invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  const { supabase, user, organization_id } = ctx;
  const { ordering_party_id, rides } = parsed.data;

  // 1. Créer la demande groupée (en_attente).
  const groupRes = await supabase
    .from('ride_groups')
    .insert({
      organization_id,
      ordering_party_id,
      status: 'en_attente',
      created_by: user.id,
    } as never)
    .select('id')
    .single();
  const group = groupRes.data as { id: string } | null;
  if (groupRes.error || !group) {
    return { error: 'Création de la demande groupée impossible.' };
  }

  // 2. Géocoder (filet serveur) puis insérer les N courses enfants `brouillon`.
  const rows = await Promise.all(
    rides.map(async (r) => {
      const [pickup, dropoff] = await Promise.all([
        geocodeIfMissing(r.pickup_address, r.pickup_lat, r.pickup_lng, r.pickup_citycode),
        geocodeIfMissing(r.dropoff_address, r.dropoff_lat, r.dropoff_lng, r.dropoff_citycode),
      ]);
      return {
        ...r,
        organization_id,
        ordering_party_id,
        ride_group_id: group.id,
        status: 'brouillon',
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_citycode: pickup.citycode,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_citycode: dropoff.citycode,
        created_by: user.id,
        updated_by: user.id,
      };
    }),
  );
  const ridesRes = await supabase.from('rides').insert(rows as never);
  if (ridesRes.error) {
    // Pas de transaction multi-table : on évite un groupe en_attente vide en le
    // marquant refusé (motif technique). Best-effort.
    await supabase
      .from('ride_groups')
      .update({ status: 'refusee', motif_refus: 'Création des courses échouée.' } as never)
      .eq('id', group.id);
    return { error: 'Création des courses de la demande impossible.' };
  }

  revalidatePath('/courses/demandes-groupees');
  return { success: true, id: group.id };
}

export async function acceptRideGroupAction(groupId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(groupId).success) {
    return { error: 'Identifiant de demande invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  // Group en_attente → acceptee (row count check : déjà traitée / hors droits).
  const g = await ctx.supabase
    .from('ride_groups')
    .update({ status: 'acceptee' } as never)
    .eq('id', groupId)
    .eq('status', 'en_attente')
    .select('id');
  if (g.error) return { error: 'Acceptation impossible.' };
  if (!g.data || (g.data as unknown[]).length === 0) {
    return { error: 'Demande déjà traitée ou introuvable.' };
  }

  // Courses enfants brouillon → validee (deviennent fermes).
  const r = await ctx.supabase
    .from('rides')
    .update({ status: 'validee' } as never)
    .eq('ride_group_id', groupId)
    .eq('status', 'brouillon');
  if (r.error) return { error: 'Validation des courses impossible.' };

  revalidatePath('/courses/demandes-groupees');
  revalidatePath('/courses');
  revalidatePath('/cockpit');
  return { success: true };
}

export async function refuseRideGroupAction(
  groupId: string,
  args: z.infer<typeof rideGroupRefusalSchema>,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(groupId).success) {
    return { error: 'Identifiant de demande invalide.' };
  }
  const parsed = rideGroupRefusalSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Motif requis.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const g = await ctx.supabase
    .from('ride_groups')
    .update({ status: 'refusee', motif_refus: parsed.data.motif } as never)
    .eq('id', groupId)
    .eq('status', 'en_attente')
    .select('id');
  if (g.error) return { error: 'Refus impossible.' };
  if (!g.data || (g.data as unknown[]).length === 0) {
    return { error: 'Demande déjà traitée ou introuvable.' };
  }

  // Courses enfants brouillon → annulee_regulateur (traçabilité).
  const r = await ctx.supabase
    .from('rides')
    .update({ status: 'annulee_regulateur' } as never)
    .eq('ride_group_id', groupId)
    .eq('status', 'brouillon');
  if (r.error) return { error: 'Annulation des courses impossible.' };

  revalidatePath('/courses/demandes-groupees');
  revalidatePath('/courses');
  return { success: true };
}
