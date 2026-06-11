import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vérification consentement SMS runtime (DEC-008 LOCKED — absolu).
 *
 * PAS DE CACHE. Chaque exécution interroge la BDD (lecture fraîche).
 *
 * Le consentement est considéré actif si :
 *   - patients.consentement_sms === true
 *   - patients.consentement_sms_at IS NOT NULL
 *
 * `isConsentValid` est la règle PURE, source unique de vérité, partagée par
 * `hasActiveSmsConsent` (1 patient) et `getActiveSmsConsentMap` (N patients,
 * crons de rappel — DEC-156). Aucune divergence de logique possible.
 */
export interface SmsConsentRow {
  consentement_sms: boolean | null;
  consentement_sms_at: string | null;
}

/** Règle de validité du consentement SMS (pure). */
export function isConsentValid(row: SmsConsentRow | null | undefined): boolean {
  return !!row && row.consentement_sms === true && row.consentement_sms_at !== null;
}

/**
 * Consentement SMS d'UN patient (fail-safe : false si introuvable ou erreur —
 * ne jamais envoyer en cas de doute).
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
  return isConsentValid(data as SmsConsentRow);
}

/**
 * Consentements de N patients en UNE requête (DEC-156 — élimine le N+1 des
 * crons de rappel). Retourne une Map `patientId → consentement valide`.
 *
 * Un patient absent du résultat (introuvable) n'est PAS dans la Map → le
 * caller le traite comme non-consentant (même fail-safe que
 * `hasActiveSmsConsent`). En cas d'ERREUR de lecture, on **throw** : le caller
 * (cron) doit alors abandonner (500) plutôt que d'envoyer dans le doute OU
 * d'écrire de faux statuts « consentement révoqué » — fail-safe préservé,
 * traçabilité non polluée.
 */
export async function getActiveSmsConsentMap(
  supabase: SupabaseClient,
  patientIds: string[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (patientIds.length === 0) return map;

  const { data, error } = await supabase
    .from('patients')
    .select('id, consentement_sms, consentement_sms_at')
    .in('id', patientIds);

  if (error) {
    throw new Error(`Lecture consentements SMS impossible : ${error.message}`);
  }

  for (const r of (data ?? []) as Array<SmsConsentRow & { id: string }>) {
    map.set(r.id, isConsentValid(r));
  }
  return map;
}
