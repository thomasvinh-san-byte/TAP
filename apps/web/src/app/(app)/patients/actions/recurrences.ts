'use server';

/**
 * Server Actions récurrences (Phase 05 Wave 3).
 *
 * 3 actions :
 *   - createRecurrenceAction : INSERT ride_recurrences + génération eager
 *     3 mois batch INSERT rides (DEC-047 LOCKED).
 *   - updateRecurrenceAction : UPDATE recurrence + DELETE rides futures
 *     non démarrées + regen — cascade DEC-048 LOCKED. Confirmation 2
 *     étapes côté UI.
 *   - cancelRecurrenceAction : archived_at = now() (rides existantes
 *     préservées).
 *
 * Pattern : Zod validation + requireAdminOrRegulateur + Supabase + audit_logs
 * + revalidatePath + DEC-041 row count check sur UPDATE.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateOccurrences } from '@tap/recurrence';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/get-auth-context';

const EAGER_MONTHS = 3;

export type RecurrenceActionState = {
  success?: true;
  error?: string;
  count?: number;
  regenerated_count?: number;
};

const baseSchema = z.object({
  patient_id: z.string().uuid(),
  rrule_str: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  pickup_address: z.string().min(1),
  dropoff_address: z.string().min(1),
  transport_mode: z.enum(['vsl', 'taxi_conventionne', 'tpmr']),
  urgency: z.enum(['normale', 'prioritaire']).default('normale'),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({ id: z.string().uuid() });

function pickFormData(formData: FormData, keys: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of keys) {
    const v = formData.get(key);
    if (v === null || v === '') continue;
    obj[key] = v;
  }
  return obj;
}

async function fetchHolidays(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const result = await supabase.from('holidays_974' as never).select('date');
  if (result.error || !result.data) return new Set();
  const rows = result.data as { date: string }[];
  return new Set(rows.map((r) => r.date));
}

function buildRidesPayload(
  occurrences: Date[],
  recurrenceId: string,
  ctx: AuthContext,
  input: z.infer<typeof baseSchema>,
): Record<string, unknown>[] {
  return occurrences.map((occ) => ({
    organization_id: ctx.organizationId,
    patient_id: input.patient_id,
    ride_recurrence_id: recurrenceId,
    pickup_address: input.pickup_address,
    dropoff_address: input.dropoff_address,
    transport_mode: input.transport_mode,
    urgency: input.urgency === 'prioritaire' ? 'urgente' : 'programmee',
    scheduled_at: occ.toISOString(),
    status: 'validee',
    created_by: ctx.userId,
  }));
}

export async function createRecurrenceAction(formData: FormData): Promise<RecurrenceActionState> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès réservé aux régulateurs et dirigeants.' };

  const raw = pickFormData(formData, [
    'patient_id',
    'rrule_str',
    'start_date',
    'end_date',
    'pickup_address',
    'dropoff_address',
    'transport_mode',
    'urgency',
  ]);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const input = parsed.data;

  const supabase = createClient();

  const insertRes = await supabase
    .from('ride_recurrences' as never)
    .insert({
      organization_id: ctx.organizationId,
      patient_id: input.patient_id,
      rrule_str: input.rrule_str,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      pickup_address: input.pickup_address,
      dropoff_address: input.dropoff_address,
      transport_mode: input.transport_mode,
      urgency: input.urgency,
      created_by: ctx.userId,
    } as never)
    .select('id')
    .single();
  const insertedRow = insertRes.data as { id: string } | null;
  if (insertRes.error || !insertedRow) {
    return { error: 'Création de la récurrence refusée.' };
  }
  const recurrenceId = insertedRow.id;

  const holidays974 = await fetchHolidays(supabase);
  const dtstart = new Date(`${input.start_date}T08:00:00`);
  const until = new Date(dtstart);
  until.setMonth(until.getMonth() + EAGER_MONTHS);

  let occurrences: Date[];
  try {
    occurrences = generateOccurrences({
      rruleStr: input.rrule_str,
      dtstart,
      until,
      holidays974,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'inconnue';
    return { error: `Règle de récurrence invalide (${reason}).` };
  }

  if (occurrences.length > 0) {
    const payload = buildRidesPayload(occurrences, recurrenceId, ctx, input);
    const ridesRes = await supabase.from('rides').insert(payload as never);
    if (ridesRes.error) {
      return { error: 'Génération des occurrences refusée.' };
    }
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'recurrence.create',
    entity_type: 'ride_recurrence',
    entity_id: recurrenceId,
    metadata: {
      patient_id: input.patient_id,
      count: occurrences.length,
      rrule_str: input.rrule_str,
    },
  } as never);

  revalidatePath(`/patients/${input.patient_id}`);
  return { success: true, count: occurrences.length };
}

async function regenerateOccurrencesFor(
  supabase: ReturnType<typeof createClient>,
  recurrenceId: string,
  ctx: AuthContext,
  input: z.infer<typeof baseSchema>,
): Promise<{ count: number; error?: string }> {
  const holidays974 = await fetchHolidays(supabase);
  const dtstart = new Date(`${input.start_date}T08:00:00`);
  const until = new Date(dtstart);
  until.setMonth(until.getMonth() + EAGER_MONTHS);

  let occurrences: Date[];
  try {
    occurrences = generateOccurrences({
      rruleStr: input.rrule_str,
      dtstart,
      until,
      holidays974,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'inconnue';
    return { count: 0, error: `Règle de récurrence invalide (${reason}).` };
  }

  if (occurrences.length === 0) return { count: 0 };

  const payload = buildRidesPayload(occurrences, recurrenceId, ctx, input);
  const ridesRes = await supabase.from('rides').insert(payload as never);
  if (ridesRes.error) return { count: 0, error: 'Régénération des occurrences refusée.' };
  return { count: occurrences.length };
}

export async function updateRecurrenceAction(formData: FormData): Promise<RecurrenceActionState> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès réservé aux régulateurs et dirigeants.' };

  const raw = pickFormData(formData, [
    'id',
    'patient_id',
    'rrule_str',
    'start_date',
    'end_date',
    'pickup_address',
    'dropoff_address',
    'transport_mode',
    'urgency',
  ]);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const { id, ...input } = parsed.data;

  const supabase = createClient();

  const upRes = await supabase
    .from('ride_recurrences' as never)
    .update({
      rrule_str: input.rrule_str,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      pickup_address: input.pickup_address,
      dropoff_address: input.dropoff_address,
      transport_mode: input.transport_mode,
      urgency: input.urgency,
    } as never)
    .eq('id', id)
    .select('id');
  if (upRes.error) return { error: 'Modification impossible.' };
  if (!upRes.data || (upRes.data as unknown[]).length === 0) {
    return { error: 'Modification refusée — droits insuffisants ou récurrence absente.' };
  }

  // CASCADE DEC-048 : delete rides futures non démarrées (validee + assignee).
  // Préserve : en_cours, terminee, annulee_*.
  const nowIso = new Date().toISOString();
  const delRes = await supabase
    .from('rides')
    .delete()
    .eq('ride_recurrence_id', id)
    .in('status', ['validee', 'assignee'])
    .gt('scheduled_at', nowIso);
  if (delRes.error) return { error: 'Suppression des occurrences futures refusée.' };

  const regen = await regenerateOccurrencesFor(supabase, id, ctx, input);
  if (regen.error) return { error: regen.error };

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'recurrence.update_cascade',
    entity_type: 'ride_recurrence',
    entity_id: id,
    metadata: {
      patient_id: input.patient_id,
      regenerated_count: regen.count,
      rrule_str: input.rrule_str,
    },
  } as never);

  revalidatePath(`/patients/${input.patient_id}`);
  return { success: true, regenerated_count: regen.count };
}

export async function cancelRecurrenceAction(recurrenceId: string): Promise<RecurrenceActionState> {
  const idParsed = z.string().uuid().safeParse(recurrenceId);
  if (!idParsed.success) return { error: 'Identifiant invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès réservé aux régulateurs et dirigeants.' };

  const supabase = createClient();

  const before = await supabase
    .from('ride_recurrences' as never)
    .select('patient_id, archived_at')
    .eq('id', idParsed.data)
    .single();
  const beforeRow = before.data as { patient_id: string; archived_at: string | null } | null;
  if (before.error || !beforeRow) return { error: 'Récurrence introuvable.' };
  if (beforeRow.archived_at) return { error: 'Récurrence déjà archivée.' };

  const upRes = await supabase
    .from('ride_recurrences' as never)
    .update({ archived_at: new Date().toISOString() } as never)
    .eq('id', idParsed.data)
    .select('id');
  if (upRes.error) return { error: 'Archivage impossible.' };
  if (!upRes.data || (upRes.data as unknown[]).length === 0) {
    return { error: 'Archivage refusé — droits insuffisants.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'recurrence.archive',
    entity_type: 'ride_recurrence',
    entity_id: idParsed.data,
    metadata: { patient_id: beforeRow.patient_id },
  } as never);

  revalidatePath(`/patients/${beforeRow.patient_id}`);
  return { success: true };
}
