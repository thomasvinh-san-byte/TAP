import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  INCIDENT_WINDOW_DAYS,
  PATIENT_INCIDENT_TYPES,
  incidentToneForTotal,
  isEscalated,
  type IncidentTone,
  type PatientIncidentType,
} from './incident-escalade';

/**
 * Query RSC de l'historique des incidents patient (PATIENT-01, CdG §5.2).
 *
 * Table `patient_incidents` absente de types.gen.ts jusqu'au resync
 * → `.from('patient_incidents' as never)` + cast de lecture (DEC-155). RLS
 * Postgres scope déjà l'organisation (lecture same-org).
 */

export interface PatientIncidentRow {
  id: string;
  type: PatientIncidentType;
  note: string | null;
  occurred_at: string;
  ride_id: string | null;
  created_at: string;
}

export interface PatientIncidentsRecap {
  /** Historique complet (antéchronologique), borné à 100 lignes. */
  incidents: PatientIncidentRow[];
  /** Compteur par type sur la fenêtre glissante (90 j). */
  countsByType: Record<PatientIncidentType, number>;
  /** Total d'incidents sur la fenêtre glissante. */
  windowTotal: number;
  /** Seuil d'escalade dirigeant franchi sur la fenêtre. */
  escalated: boolean;
  /** État visuel global (neutre / attention / alerte). */
  tone: IncidentTone;
}

const SELECT_COLUMNS = 'id, type, note, occurred_at, ride_id, created_at';
const HISTORY_LIMIT = 100;

function emptyCounts(): Record<PatientIncidentType, number> {
  return PATIENT_INCIDENT_TYPES.reduce(
    (acc, t) => ({ ...acc, [t]: 0 }),
    {} as Record<PatientIncidentType, number>,
  );
}

function windowCutoffIso(): string {
  const cutoff = new Date(Date.now() - INCIDENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

/**
 * Liste les incidents d'un patient (occurred_at décroissant) et calcule le
 * compteur par type sur la fenêtre glissante. Le compteur est dérivé en JS
 * depuis la liste (un seul aller-retour) : le volume par patient est faible.
 */
export async function getPatientIncidents(patientId: string): Promise<PatientIncidentsRecap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('patient_incidents' as never)
    .select(SELECT_COLUMNS)
    .eq('patient_id', patientId)
    .order('occurred_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const incidents = (data as PatientIncidentRow[] | null) ?? [];

  const cutoff = windowCutoffIso();
  const countsByType = emptyCounts();
  let windowTotal = 0;
  for (const incident of incidents) {
    if (incident.occurred_at >= cutoff) {
      countsByType[incident.type] += 1;
      windowTotal += 1;
    }
  }

  return {
    incidents,
    countsByType,
    windowTotal,
    escalated: isEscalated(windowTotal),
    tone: incidentToneForTotal(windowTotal),
  };
}
