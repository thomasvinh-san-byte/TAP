import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  computeHistoriqueDiff,
  type HistoriqueDiff,
  type PrevuRow,
  type RealiseRow,
} from './historique-diff';

/**
 * Données de l'historique prévu vs réalisé d'un jour (Module 5.12 lot E). Repose
 * sur l'instantané figé à la validation (lot D). Sans validation, `validated:
 * false` → l'UI signale « aucun planning validé » plutôt qu'une fausse
 * comparaison. RLS Postgres scope l'organisation.
 */

export interface RideLabel {
  patient: string;
  driver: string | null;
}

export interface PlanningHistorique {
  validated: boolean;
  validatedAt?: string;
  diff?: HistoriqueDiff;
  /** ride_id → libellés d'affichage (patient, chauffeur courant). */
  labels: Record<string, RideLabel>;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface RawRealiseRide {
  id: string;
  driver_id: string | null;
  status: string;
  scheduled_at: string;
  started_at: string | null;
  patient: { prenom: string | null; nom: string | null } | null;
  driver: { nom_affichage: string | null } | null;
}

function reunionDayBounds(date: string): { start: string; endExclusive: string } {
  const start = `${date}T00:00:00+04:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, endExclusive: `${next.toISOString().slice(0, 10)}T00:00:00+04:00` };
}

function patientLabel(p: { prenom: string | null; nom: string | null } | null): string {
  if (!p) return 'Patient';
  const nom = p.nom?.trim();
  const prenom = p.prenom?.trim();
  if (nom && prenom) return `${nom} ${prenom[0]}.`;
  return nom || prenom || 'Patient';
}

async function getSnapshot(
  supabase: SupabaseServerClient,
  validationId: string,
): Promise<PrevuRow[]> {
  const { data, error } = await supabase
    .from('planning_validation_rides')
    .select('ride_id, driver_id, scheduled_at, status')
    .eq('validation_id', validationId);
  if (error) {
    console.error('[planning] Erreur lecture instantané:', error);
    return [];
  }
  return ((data as PrevuRow[] | null) ?? []).map((r) => ({
    ride_id: r.ride_id,
    driver_id: r.driver_id,
    scheduled_at: r.scheduled_at,
    status: r.status,
  }));
}

async function getRealise(
  supabase: SupabaseServerClient,
  date: string,
): Promise<{ rows: RealiseRow[]; labels: Record<string, RideLabel> }> {
  const { start, endExclusive } = reunionDayBounds(date);
  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, driver_id, status, scheduled_at, started_at, ' +
        'patient:patients(prenom, nom), driver:drivers(nom_affichage)',
    )
    .gte('scheduled_at', start)
    .lt('scheduled_at', endExclusive)
    .neq('status', 'brouillon');
  if (error) {
    console.error('[planning] Erreur lecture réalisé:', error);
    return { rows: [], labels: {} };
  }
  const rides = (data as unknown as RawRealiseRide[] | null) ?? [];
  const labels: Record<string, RideLabel> = {};
  const rows: RealiseRow[] = rides.map((r) => {
    labels[r.id] = { patient: patientLabel(r.patient), driver: r.driver?.nom_affichage ?? null };
    return {
      id: r.id,
      driver_id: r.driver_id,
      status: r.status,
      scheduled_at: r.scheduled_at,
      started_at: r.started_at,
    };
  });
  return { rows, labels };
}

export async function getPlanningHistorique(date: string): Promise<PlanningHistorique> {
  const supabase = await createClient();
  const val = await supabase
    .from('planning_validations')
    .select('id, validated_at')
    .eq('planning_date', date)
    .maybeSingle();
  if (val.error) {
    console.error('[planning] Erreur lecture validation (historique):', val.error);
    return { validated: false, labels: {} };
  }
  const validation = val.data as { id: string; validated_at: string } | null;
  if (!validation) return { validated: false, labels: {} };

  const [prevu, realise] = await Promise.all([
    getSnapshot(supabase, validation.id),
    getRealise(supabase, date),
  ]);

  return {
    validated: true,
    validatedAt: validation.validated_at,
    diff: computeHistoriqueDiff(prevu, realise.rows),
    labels: realise.labels,
  };
}
