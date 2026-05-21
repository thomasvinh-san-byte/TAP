import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database/types';

/**
 * Helper portabilité (art. 15 + art. 20 RGPD) — D-10 / DPA-04.
 * Lit la vue `patients_safe` (jamais la table directe : T-1.5-11)
 * + tables liées + audit_logs filtrés par entity_id.
 *
 * Le NIR clair n'est PAS récupéré ici : un appel séparé à l'Edge Function
 * `nir-decrypt` (avec audit log automatique) est requis si décryptage demandé.
 * V1 : `patient.nir = null` toujours. `has_nir` reste exposé via la vue.
 */
export type PatientDataExport = {
  format_version: '1.0';
  exported_at: string;
  patient: Record<string, unknown> & { nir: string | null };
  operational_notes: unknown[];
  constraintes: unknown[];
  audit_log: unknown[];
};

export async function generatePatientDataExport(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<PatientDataExport> {
  const [{ data: patient, error: e1 }, notesRes, constraintesRes, auditsRes] = await Promise.all([
    supabase.from('patients_safe').select('*').eq('id', patientId).single(),
    supabase.from('patient_operational_note').select('*').eq('patient_id', patientId),
    supabase.from('patient_constraint').select('*').eq('patient_id', patientId),
    supabase.from('audit_logs').select('*').eq('entity_id', patientId),
  ]);
  if (e1 || !patient) throw new Error('Patient introuvable.');
  return {
    format_version: '1.0',
    exported_at: new Date().toISOString(),
    patient: { ...(patient as Record<string, unknown>), nir: null },
    operational_notes: notesRes.data ?? [],
    constraintes: constraintesRes.data ?? [],
    audit_log: auditsRes.data ?? [],
  };
}
