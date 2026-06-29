'use server';

/**
 * Server Action — création d'un incident patient (PATIENT-01, CdG §5.2).
 *
 * Journal IMMUABLE : seule la création est exposée (pas d'édition / suppression,
 * cohérent avec la migration). Validation zod, guard régulateur/dirigeant,
 * INSERT (RLS forcée), revalidate de la fiche patient. Audit géré par trigger
 * Postgres `patient_incidents_audit_trigger`. Table absente de types.gen.ts
 * → `.from('patient_incidents' as never)` + payload `as never` (DEC-155).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { PATIENT_INCIDENT_TYPES } from '../[id]/_lib/incident-escalade';

const INCIDENT_NOTE_MAX = 500;

const createIncidentSchema = z.object({
  patientId: z.string().uuid(),
  type: z.enum(PATIENT_INCIDENT_TYPES as unknown as [string, ...string[]]),
  note: z.string().max(INCIDENT_NOTE_MAX).optional(),
  occurredAt: z.string().datetime().optional(),
  rideId: z.string().uuid().optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export async function createPatientIncidentAction(
  input: CreateIncidentInput,
): Promise<{ success?: true; error?: string }> {
  const parsed = createIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Incident invalide.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou au dirigeant.' };

  const d = parsed.data;
  const { error } = await ctx.supabase.from('patient_incidents' as never).insert({
    organization_id: ctx.organizationId,
    patient_id: d.patientId,
    type: d.type,
    note: d.note && d.note.length > 0 ? d.note : null,
    occurred_at: d.occurredAt ?? new Date().toISOString(),
    ride_id: d.rideId ?? null,
    created_by: ctx.userId,
  } as never);

  if (error) return { error: "Enregistrement de l'incident impossible." };

  revalidatePath(`/patients/${d.patientId}`);
  return { success: true };
}
