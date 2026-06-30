import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Query RSC des préférences patient d'un chauffeur (CHAUFFEUR-03, §5.6) —
 * direction chauffeur → patient (origin='chauffeur'). Miroir de
 * `getPatientDriverPreferences`. Table absente de types.gen.ts → casts
 * `as never` (DEC-155) ; RLS scope l'org et réserve l'accès régulateur/dirigeant.
 */

export type PreferenceKind = 'prefere' | 'evite';

export interface DriverPatientPreferenceItem {
  id: string;
  patient_id: string;
  patient_name: string;
}

export interface DriverPatientPreferences {
  prefere: DriverPatientPreferenceItem[];
  evite: DriverPatientPreferenceItem[];
}

interface PreferenceRow {
  id: string;
  patient_id: string;
  kind: PreferenceKind;
}

/** Patients préférés / évités par un chauffeur (direction chauffeur). */
export async function getDriverPatientPreferences(
  driverId: string,
): Promise<DriverPatientPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('patient_driver_preference' as never)
    .select('id, patient_id, kind')
    .eq('driver_id', driverId)
    .eq('origin' as never, 'chauffeur' as never);
  const rows = (data as PreferenceRow[] | null) ?? [];
  if (rows.length === 0) return { prefere: [], evite: [] };

  const patientIds = rows.map((r) => r.patient_id);
  const { data: patientData } = await supabase
    .from('patients_safe')
    .select('id, nom, prenom')
    .in('id', patientIds);
  const nameById = new Map(
    ((patientData as { id: string; nom: string; prenom: string }[] | null) ?? []).map((p) => [
      p.id,
      `${p.nom} ${p.prenom}`.trim(),
    ]),
  );

  const toItem = (r: PreferenceRow): DriverPatientPreferenceItem => ({
    id: r.id,
    patient_id: r.patient_id,
    patient_name: nameById.get(r.patient_id) ?? 'Patient',
  });

  return {
    prefere: rows.filter((r) => r.kind === 'prefere').map(toItem),
    evite: rows.filter((r) => r.kind === 'evite').map(toItem),
  };
}
