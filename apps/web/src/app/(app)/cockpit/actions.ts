'use server';

/**
 * Server Actions cockpit (Phase 05 Wave 6 — décision post no-show).
 *
 * - rescheduleRideAction : clone le ride original avec original_ride_id
 *   pointant vers le ride no-show, status validee, nouvelle scheduled_at.
 *   Préserve ride_recurrence_id (si patient récurrent).
 * - cancelRideForNoShowAction : UPDATE status annulee_patient (DEC-041).
 *
 * Pattern Zod + requireAdminOrRegulateur + Supabase + audit_logs + DEC-041
 * row count check.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { createClient } from '@/lib/supabase/server';

export type CockpitActionState = {
  success?: true;
  error?: string;
  new_ride_id?: string;
};

const rescheduleSchema = z.object({
  ride_id: z.string().uuid(),
  new_scheduled_at: z.string().datetime(),
});

const cancelSchema = z.object({
  ride_id: z.string().uuid(),
});

interface OriginalRide {
  id: string;
  organization_id: string;
  patient_id: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_citycode: string | null;
  dropoff_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_citycode: string | null;
  transport_mode: string;
  urgency: string;
  ride_recurrence_id: string | null;
}

function pickFormData(formData: FormData, keys: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (value === null || value === '') continue;
    obj[key] = value;
  }
  return obj;
}

export async function rescheduleRideAction(formData: FormData): Promise<CockpitActionState> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée aux régulateurs et dirigeants.' };

  const parsed = rescheduleSchema.safeParse(
    pickFormData(formData, ['ride_id', 'new_scheduled_at']),
  );
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();

  const origRes = await supabase
    .from('rides')
    .select(
      'id, organization_id, patient_id, pickup_address, pickup_lat, pickup_lng, ' +
        'pickup_citycode, dropoff_address, dropoff_lat, dropoff_lng, dropoff_citycode, ' +
        'transport_mode, urgency, ride_recurrence_id',
    )
    .eq('id', parsed.data.ride_id)
    .single();
  const original = origRes.data as OriginalRide | null;
  if (origRes.error || !original) {
    return { error: 'Course introuvable.' };
  }

  const insertRes = await supabase
    .from('rides')
    .insert({
      organization_id: original.organization_id,
      patient_id: original.patient_id,
      pickup_address: original.pickup_address,
      pickup_lat: original.pickup_lat,
      pickup_lng: original.pickup_lng,
      pickup_citycode: original.pickup_citycode,
      dropoff_address: original.dropoff_address,
      dropoff_lat: original.dropoff_lat,
      dropoff_lng: original.dropoff_lng,
      dropoff_citycode: original.dropoff_citycode,
      transport_mode: original.transport_mode,
      urgency: original.urgency,
      scheduled_at: parsed.data.new_scheduled_at,
      status: 'validee',
      ride_recurrence_id: original.ride_recurrence_id,
      original_ride_id: original.id,
      created_by: ctx.userId,
    } as never)
    .select('id')
    .single();
  const cloned = insertRes.data as { id: string } | null;
  if (insertRes.error || !cloned) {
    return { error: 'Reprogrammation refusée.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'ride.reschedule_after_no_show',
    entity_type: 'ride',
    entity_id: cloned.id,
    metadata: {
      original_ride_id: original.id,
      new_ride_id: cloned.id,
      new_scheduled_at: parsed.data.new_scheduled_at,
    },
  } as never);

  revalidatePath('/cockpit');
  return { success: true, new_ride_id: cloned.id };
}

export async function cancelRideForNoShowAction(rideId: string): Promise<CockpitActionState> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée aux régulateurs et dirigeants.' };

  const parsed = cancelSchema.safeParse({ ride_id: rideId });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Identifiant invalide.' };
  }

  const supabase = await createClient();
  const upRes = await supabase
    .from('rides')
    .update({
      status: 'annulee_patient',
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data.ride_id)
    .select('id');
  if (upRes.error) return { error: 'Annulation impossible.' };
  if (!upRes.data || (upRes.data as unknown[]).length === 0) {
    return { error: 'Annulation refusée : droits insuffisants ou course absente.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'ride.cancel_for_no_show',
    entity_type: 'ride',
    entity_id: parsed.data.ride_id,
    metadata: {},
  } as never);

  revalidatePath('/cockpit');
  return { success: true };
}
