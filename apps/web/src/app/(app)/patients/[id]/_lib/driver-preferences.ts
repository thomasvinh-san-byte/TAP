import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Queries RSC des préférences chauffeur d'un patient (PATIENT-02, CdG §5.2).
 *
 * Table `patient_driver_preference` absente de types.gen.ts jusqu'au resync
 * → `.from('patient_driver_preference' as never)` + cast de lecture (DEC-155).
 * RLS Postgres scope déjà l'organisation et réserve l'accès régulateur/dirigeant.
 *
 * Deux lectures :
 *   - `getPatientDriverPreferences` : listes préférés / évités pour la fiche
 *     patient — direction patient → chauffeur uniquement (origin='patient').
 *   - `getDriverPreferenceLookupForPatient` : lookup driverId → kind pour
 *     décorer le modal d'assignation — combine LES DEUX directions
 *     (CHAUFFEUR-03), évité prioritaire en cas de divergence.
 */

export type DriverPreferenceKind = 'prefere' | 'evite';

export interface PatientDriverPreferenceItem {
  id: string;
  driver_id: string;
  driver_name: string;
}

export interface PatientDriverPreferences {
  prefere: PatientDriverPreferenceItem[];
  evite: PatientDriverPreferenceItem[];
}

interface PreferenceRow {
  id: string;
  driver_id: string;
  kind: DriverPreferenceKind;
}

async function fetchPreferenceRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  origin?: 'patient' | 'chauffeur',
): Promise<PreferenceRow[]> {
  let query = supabase
    .from('patient_driver_preference' as never)
    .select('id, driver_id, kind')
    .eq('patient_id', patientId);
  if (origin) query = query.eq('origin' as never, origin as never);
  const { data } = await query;
  return (data as PreferenceRow[] | null) ?? [];
}

/** Listes des chauffeurs préférés / évités d'un patient (direction patient). */
export async function getPatientDriverPreferences(
  patientId: string,
): Promise<PatientDriverPreferences> {
  const supabase = await createClient();
  const rows = await fetchPreferenceRows(supabase, patientId, 'patient');
  if (rows.length === 0) return { prefere: [], evite: [] };

  const driverIds = rows.map((r) => r.driver_id);
  const { data: driverData } = await supabase
    .from('drivers')
    .select('id, nom_affichage')
    .in('id', driverIds);
  const nameById = new Map(
    ((driverData as { id: string; nom_affichage: string }[] | null) ?? []).map((d) => [
      d.id,
      d.nom_affichage,
    ]),
  );

  const toItem = (r: PreferenceRow): PatientDriverPreferenceItem => ({
    id: r.id,
    driver_id: r.driver_id,
    driver_name: nameById.get(r.driver_id) ?? 'Chauffeur',
  });

  return {
    prefere: rows.filter((r) => r.kind === 'prefere').map(toItem),
    evite: rows.filter((r) => r.kind === 'evite').map(toItem),
  };
}

/**
 * Lookup driverId → kind pour un patient (décoration du modal d'assignation).
 * Combine les deux directions (patient→chauffeur ET chauffeur→patient) :
 * « évité » l'emporte sur « préféré » si les deux directions divergent, car un
 * avertissement à franchir prime sur une simple mise en avant.
 */
export async function getDriverPreferenceLookupForPatient(
  patientId: string,
): Promise<Record<string, DriverPreferenceKind>> {
  const supabase = await createClient();
  const rows = await fetchPreferenceRows(supabase, patientId);
  const lookup: Record<string, DriverPreferenceKind> = {};
  for (const r of rows) {
    // évité prioritaire : ne jamais écraser un 'evite' déjà posé par un 'prefere'.
    if (lookup[r.driver_id] === 'evite') continue;
    lookup[r.driver_id] = r.kind;
  }
  return lookup;
}
