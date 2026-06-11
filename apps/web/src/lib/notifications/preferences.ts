import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Préférences d'alertes cockpit d'un utilisateur (DEC-149).
 *
 * Clés alignées sur `CockpitAlertType` (cockpit/_lib/types.ts) pour permettre
 * un filtrage direct `prefs[alert.event_type]`.
 */
export type CockpitAlertPreferences = {
  patient_no_show: boolean;
  sms_failed: boolean;
  ride_delayed: boolean;
};

/** Défaut : tout activé (rétro-compatible — comportement actuel, tout affiché). */
export const DEFAULT_COCKPIT_ALERT_PREFERENCES: CockpitAlertPreferences = {
  patient_no_show: true,
  sms_failed: true,
  ride_delayed: true,
};

type PreferenceRow = {
  alert_patient_no_show: boolean;
  alert_sms_failed: boolean;
  alert_ride_delayed: boolean;
};

/**
 * Lit les préférences d'alertes cockpit de l'utilisateur courant.
 *
 * Lazy : aucune ligne en base = tous les défauts (rétro-compatibilité). RLS
 * `user_id = auth.uid()` garantit qu'on ne lit que les siennes ; lecture
 * best-effort (si la table n'est pas encore déployée, on dégrade au défaut).
 */
export async function getCockpitAlertPreferences(): Promise<CockpitAlertPreferences> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEFAULT_COCKPIT_ALERT_PREFERENCES;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('alert_patient_no_show, alert_sms_failed, alert_ride_delayed')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return DEFAULT_COCKPIT_ALERT_PREFERENCES;

    const row = data as PreferenceRow;
    return {
      patient_no_show: row.alert_patient_no_show,
      sms_failed: row.alert_sms_failed,
      ride_delayed: row.alert_ride_delayed,
    };
  } catch {
    return DEFAULT_COCKPIT_ALERT_PREFERENCES;
  }
}
