import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database/types';

/**
 * Helper effacement (art. 17 RGPD) — D-10 / DPA-04.
 * Délègue à la RPC SQL `rgpd_anonymize_patient` qui exécute, dans une
 * transaction unique avec advisory lock côté DB :
 *   - mise à NULL de l'identité patient + NIR rotated hash via salt
 *   - effacement des notes opérationnelles et contraintes
 *   - insertion des audit_logs
 *
 * NE SUPPRIME JAMAIS les rides (durée légale CGSS L114-19, R5 RESEARCH).
 * Aucune mutation directe côté TS (T-1.5-12) — tout passe par la RPC
 * SECURITY DEFINER qui applique les garde-fous DB.
 */
export async function anonymizePatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  requestId: string,
): Promise<void> {
  const salt = process.env.APP_ANONYMIZATION_SALT;
  if (!salt || salt.length < 16) {
    throw new Error('APP_ANONYMIZATION_SALT manquant ou trop court (≥ 16 bytes requis).');
  }
  const { error } = await supabase.rpc('rgpd_anonymize_patient', {
    p_patient_id: patientId,
    p_request_id: requestId,
    p_salt: salt,
  });
  if (error) {
    throw new Error(`Anonymisation échouée : ${error.message}`);
  }
}
