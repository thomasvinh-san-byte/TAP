/**
 * Lecture du mode alerte météo / cyclone (DEC-170, CdG l.380-385).
 *
 * RLS Postgres (weather_alerts_select_same_org) isole par org ; le cast
 * `as never` ne contourne que le typage TS jusqu'au resync de types.gen.ts
 * (weather_alerts nouvelle table — DEC-155). L'épisode actif est unique par org
 * (index unique partiel) → `maybeSingle()` suffit.
 */

import { createClient } from '@/lib/supabase/server';

export type WeatherAlert = {
  id: string;
  active: boolean;
  motif: string;
  zone: string | null;
  activated_at: string;
};

/**
 * Épisode météo actif de l'organisation, ou `null`. Erreur loggée → `null`
 * (jamais de throw) pour une consommation sûre dans un `Promise.all` (cockpit).
 */
export async function getActiveWeatherAlert(): Promise<WeatherAlert | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('weather_alerts' as never)
      .select('id, active, motif, zone, activated_at')
      .eq('active' as never, true as never)
      .maybeSingle();
    if (error) {
      console.error('[meteo] lecture épisode actif échouée:', error.message);
      return null;
    }
    return (data as WeatherAlert | null) ?? null;
  } catch (err) {
    console.error('[meteo] weather_alerts non disponible:', err);
    return null;
  }
}
