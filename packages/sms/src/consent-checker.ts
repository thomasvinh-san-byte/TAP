import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vérification consentement SMS runtime (DEC-008 LOCKED — absolu).
 *
 * PAS DE CACHE. Chaque envoi SMS interroge la BDD.
 *
 * Le consentement est considéré actif si :
 *   - patients.consentement_sms === true
 *   - patients.consentement_sms_at IS NOT NULL
 *
 * Retourne false si :
 *   - patient non trouvé
 *   - consentement révoqué (false)
 *   - erreur réseau (fail-safe : ne pas envoyer SMS si doute)
 */
export async function hasActiveSmsConsent(
  supabase: SupabaseClient,
  patientId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('patients')
    .select('consentement_sms, consentement_sms_at')
    .eq('id', patientId)
    .maybeSingle();

  if (error || !data) return false;
  const row = data as { consentement_sms: boolean | null; consentement_sms_at: string | null };
  return row.consentement_sms === true && row.consentement_sms_at !== null;
}
