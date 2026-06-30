'use server';

/**
 * Server Actions — préférences patient d'un chauffeur (CHAUFFEUR-03, §5.6).
 *
 * Direction chauffeur → patient (origin='chauffeur') — miroir de PATIENT-02.
 * Cœur partagé `@/lib/driver-preferences` (exclusion mutuelle par direction,
 * sans motif). Garde régulateur/dirigeant. Audit géré par trigger Postgres.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { addPreference, removePreferenceById } from '@/lib/driver-preferences/mutations';
import {
  getDriverPatientPreferences,
  type DriverPatientPreferences,
} from './_lib/patient-preferences';

const KINDS = ['prefere', 'evite'] as const;

const addSchema = z.object({
  driverId: z.string().uuid(),
  patientId: z.string().uuid(),
  kind: z.enum(KINDS),
});

const removeSchema = z.object({
  driverId: z.string().uuid(),
  preferenceId: z.string().uuid(),
});

const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  prefere: 'préféré',
  evite: 'évité',
};

const EMPTY: DriverPatientPreferences = { prefere: [], evite: [] };

export async function getDriverPatientPreferencesAction(
  driverId: string,
): Promise<DriverPatientPreferences> {
  if (!z.string().uuid().safeParse(driverId).success) return EMPTY;
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return EMPTY;
  return getDriverPatientPreferences(driverId);
}

export async function addPatientPreferenceAction(
  input: z.infer<typeof addSchema>,
): Promise<{ success?: true; error?: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: 'Préférence invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou au dirigeant.' };

  const { driverId, patientId, kind } = parsed.data;
  const res = await addPreference(ctx, { patientId, driverId, kind, origin: 'chauffeur' });
  if ('conflict' in res) {
    return {
      error: `Ce patient est déjà marqué comme ${KIND_LABEL[res.conflict]}. Retirez-le d'abord.`,
    };
  }
  if ('error' in res) return { error: res.error };

  revalidatePath('/admin/chauffeurs');
  return { success: true };
}

export async function removePatientPreferenceAction(
  input: z.infer<typeof removeSchema>,
): Promise<{ success?: true; error?: string }> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { error: 'Préférence invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou au dirigeant.' };

  const res = await removePreferenceById(ctx, parsed.data.preferenceId);
  if ('error' in res) return { error: res.error };

  revalidatePath('/admin/chauffeurs');
  return { success: true };
}
