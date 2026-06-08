'use server';

/**
 * Server Actions archivage patients (Phase 04.7-bis élargi hotfix UX).
 *
 * Pattern soft-delete healthcare (HSE/HIPAA/GDPR) :
 *   - archive boolean + archive_at timestamptz (déjà en place migration
 *     Phase 1 patients) → mute archive = true/false + archive_at = now()/null
 *   - Archiver : régulateur + dirigeant
 *   - Désarchiver (réactiver) : dirigeant uniquement (action sensible)
 *   - Hard-delete réservé Phase 06 HDS sur demande RGPD explicite
 *
 * Pattern DEC-041 row count check appliqué (RLS rejette silencieusement
 * UPDATE sans match — sans `.select()` check, faux success affiché).
 *
 * Refs : Phase 04.7-bis hotfix UX élargi, UI-PATTERNS soft-delete
 * healthcare, DEC-041.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { createClient } from '@/lib/supabase/server';

export type PatientArchiveState = { success?: true; error?: string };

const patientIdSchema = z.string().uuid();

export async function archivePatientAction(patientId: string): Promise<PatientArchiveState> {
  const parsed = patientIdSchema.safeParse(patientId);
  if (!parsed.success) return { error: 'Identifiant patient invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

  const supabase = await createClient();

  // Lire l'état actuel pour audit metadata
  const before = await supabase
    .from('patients')
    .select('nom, prenom, archive, organization_id')
    .eq('id', parsed.data)
    .single();
  const beforeRow = before.data as {
    nom: string;
    prenom: string;
    archive: boolean;
    organization_id: string;
  } | null;
  if (before.error || !beforeRow) return { error: 'Patient introuvable.' };
  if (beforeRow.archive) return { error: 'Patient déjà archivé.' };

  // UPDATE avec pattern DEC-041 row count check
  const updated = await supabase
    .from('patients')
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data)
    .select('id');
  if (updated.error) return { error: 'Archivage impossible.' };
  if (!updated.data || updated.data.length === 0) {
    return { error: 'Archivage refusé : droits insuffisants.' };
  }

  // Trace audit_logs explicite (trigger patients_audit_trigger capte déjà
  // l'UPDATE, mais on enrichit avec action sémantique pour audit log UI).
  await supabase.from('audit_logs').insert({
    organization_id: beforeRow.organization_id,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'patient.archived',
    entity_type: 'patient',
    entity_id: parsed.data,
    metadata: {
      patient_nom: beforeRow.nom,
      patient_prenom: beforeRow.prenom,
    },
  } as never);

  revalidatePath('/patients');
  return { success: true };
}

export async function unarchivePatientAction(patientId: string): Promise<PatientArchiveState> {
  const parsed = patientIdSchema.safeParse(patientId);
  if (!parsed.success) return { error: 'Identifiant patient invalide.' };

  // Réactivation = dirigeant only (action sensible — pattern DEC-029
  // sémantique 4 actions : Archiver = régulateur+, Désarchiver = dirigeant)
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Réactivation réservée au dirigeant.' };

  const supabase = await createClient();

  const before = await supabase
    .from('patients')
    .select('nom, prenom, archive, organization_id')
    .eq('id', parsed.data)
    .single();
  const beforeRow = before.data as {
    nom: string;
    prenom: string;
    archive: boolean;
    organization_id: string;
  } | null;
  if (before.error || !beforeRow) return { error: 'Patient introuvable.' };
  if (!beforeRow.archive) return { error: 'Patient déjà actif.' };

  const updated = await supabase
    .from('patients')
    .update({
      archive: false,
      archive_at: null,
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data)
    .select('id');
  if (updated.error) return { error: 'Réactivation impossible.' };
  if (!updated.data || updated.data.length === 0) {
    return { error: 'Réactivation refusée : droits insuffisants.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: beforeRow.organization_id,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'patient.unarchived',
    entity_type: 'patient',
    entity_id: parsed.data,
    metadata: {
      patient_nom: beforeRow.nom,
      patient_prenom: beforeRow.prenom,
    },
  } as never);

  revalidatePath('/patients');
  return { success: true };
}
