'use server';

/**
 * Server Actions — prescriptions / bons de transport (CdG §5.3, DEC-163).
 *
 * Saisie structurée + lecture. Le COMPTEUR de trajets (trajets_consommes) et le
 * STATUT (active/epuisee/expiree) sont gérés par trigger Postgres idempotent
 * (migration 20260612000006) — JAMAIS écrits ici à la main. Écriture réservée
 * dirigeant + régulateur (RLS double-check). Dette types : table prescriptions
 * absente de types.gen.ts → `.from('prescriptions' as never)` + `as never`.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prescriptionInputSchema, type PrescriptionStatus } from '@tap/shared';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';

export type PrescriptionActionState = { success?: boolean; id?: string; error?: string };

export type PatientPrescriptionRow = {
  id: string;
  numero: string;
  date_prescription: string;
  prescriber_id: string | null;
  finess: string | null;
  motif: string | null;
  type_transport: string | null;
  trajets_autorises: number;
  trajets_consommes: number;
  date_expiration: string | null;
  statut: PrescriptionStatus;
  created_at: string;
};

const SELECT_COLUMNS =
  'id, numero, date_prescription, prescriber_id, finess, motif, type_transport, ' +
  'trajets_autorises, trajets_consommes, date_expiration, statut, created_at';

function nullifyEmpty(value: string | null | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

/** Prescriptions d'un patient (RLS scope org). Tri date décroissante. */
export async function listPrescriptionsForPatientAction(
  patientId: string,
): Promise<PatientPrescriptionRow[]> {
  if (!z.string().uuid().safeParse(patientId).success) return [];
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from('prescriptions' as never)
    .select(SELECT_COLUMNS)
    .eq('patient_id', patientId)
    .order('date_prescription', { ascending: false })
    .limit(100);
  return (data as PatientPrescriptionRow[] | null) ?? [];
}

export async function createPrescriptionAction(
  args: z.infer<typeof prescriptionInputSchema>,
): Promise<PrescriptionActionState> {
  const parsed = prescriptionInputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Prescription invalide.' };
  }
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from('prescriptions' as never)
    .insert({
      organization_id: ctx.organizationId,
      patient_id: d.patient_id,
      prescriber_id: d.prescriber_id || null,
      numero: d.numero,
      date_prescription: d.date_prescription,
      finess: nullifyEmpty(d.finess),
      motif: nullifyEmpty(d.motif),
      type_transport: nullifyEmpty(d.type_transport),
      trajets_autorises: d.trajets_autorises,
      date_expiration: nullifyEmpty(d.date_expiration),
      created_by: ctx.userId,
    } as never)
    .select('id')
    .single();

  if (error || !data) return { error: 'Création de la prescription impossible.' };
  revalidatePath(`/patients/${d.patient_id}`);
  return { success: true, id: (data as { id: string }).id };
}
