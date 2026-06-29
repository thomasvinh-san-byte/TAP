'use server';

/**
 * Server Actions — préférences chauffeur du patient (PATIENT-02, CdG §5.2).
 *
 * Ajout / retrait d'un chauffeur préféré ou évité. Garde régulateur/dirigeant,
 * exclusion mutuelle (un chauffeur ne peut être à la fois préféré ET évité pour
 * un même patient — la contrainte unique (patient_id, driver_id) le garantit en
 * base ; on la pré-vérifie pour rendre un message clair). Audit géré par trigger
 * Postgres. Table absente de types.gen.ts → `as never` (DEC-155).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';

const KINDS = ['prefere', 'evite'] as const;

const addSchema = z.object({
  patientId: z.string().uuid(),
  driverId: z.string().uuid(),
  kind: z.enum(KINDS),
});

const removeSchema = z.object({
  patientId: z.string().uuid(),
  preferenceId: z.string().uuid(),
});

const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  prefere: 'préféré',
  evite: 'évité',
};

export async function addDriverPreferenceAction(
  input: z.infer<typeof addSchema>,
): Promise<{ success?: true; error?: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: 'Préférence invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou au dirigeant.' };

  const { patientId, driverId, kind } = parsed.data;

  // Exclusion mutuelle : un chauffeur n'a qu'une préférence par patient.
  const existingRes = await ctx.supabase
    .from('patient_driver_preference' as never)
    .select('kind')
    .eq('patient_id', patientId)
    .eq('driver_id', driverId)
    .maybeSingle();
  const existing = existingRes.data as { kind: (typeof KINDS)[number] } | null;
  if (existing) {
    if (existing.kind === kind) return { success: true };
    return {
      error: `Ce chauffeur est déjà marqué comme ${KIND_LABEL[existing.kind]}. Retirez-le d'abord.`,
    };
  }

  const { error } = await ctx.supabase.from('patient_driver_preference' as never).insert({
    organization_id: ctx.organizationId,
    patient_id: patientId,
    driver_id: driverId,
    kind,
    created_by: ctx.userId,
  } as never);
  if (error) return { error: 'Enregistrement de la préférence impossible.' };

  revalidatePath(`/patients/${patientId}`);
  return { success: true };
}

export async function removeDriverPreferenceAction(
  input: z.infer<typeof removeSchema>,
): Promise<{ success?: true; error?: string }> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { error: 'Préférence invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou au dirigeant.' };

  const { error, data } = await ctx.supabase
    .from('patient_driver_preference' as never)
    .delete()
    .eq('id', parsed.data.preferenceId)
    .select('id');
  if (error) return { error: 'Suppression impossible.' };
  // DEC-041 — row count check : RLS rejette en silence hors droits.
  if (!data || (data as unknown[]).length === 0) {
    return { error: 'Préférence introuvable : droits insuffisants.' };
  }

  revalidatePath(`/patients/${parsed.data.patientId}`);
  return { success: true };
}
