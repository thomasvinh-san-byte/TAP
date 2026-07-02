/**
 * Lecture replanification (régulation, DEC-160) — incidents ouverts + courses
 * restantes du chauffeur en incident + propositions de réaffectation scorées.
 *
 * RLS Postgres (driver_incidents_select_org, rides/drivers same-org) isole par
 * org ; les casts `as never` ne contournent que le typage TS jusqu'au resync
 * de types.gen.ts (driver_incidents nouvelle table — DEC-155). Pas de N+1 :
 * tout est chargé en requêtes groupées `.in()` puis agrégé en mémoire.
 */

import { createClient } from '@/lib/supabase/server';
import {
  proposeReassignments,
  type ReassignCandidate,
  type RideProposal,
  type RideToReassign,
} from '@/lib/replanning/reassign';

type IncidentRow = {
  id: string;
  driver_id: string;
  type: 'panne_vehicule' | 'indisponible';
  nature: string | null;
  lieu: string | null;
  started_at: string;
};

type DriverRow = { id: string; nom_affichage: string; type_permis: string[] };

type RideRow = {
  id: string;
  driver_id: string;
  transport_mode: RideToReassign['transport_mode'];
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_address: string | null;
  scheduled_at: string;
  patient_id: string;
};

type CandidateRideRow = {
  driver_id: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  scheduled_at: string;
};

export interface IncidentRideView {
  rideId: string;
  patientLabel: string;
  pickupAddress: string;
  scheduledAt: string;
  transportMode: string;
  proposal: RideProposal;
}

export interface IncidentWithProposals {
  incidentId: string;
  driverId: string;
  driverLabel: string;
  type: 'panne_vehicule' | 'indisponible';
  nature: string | null;
  lieu: string | null;
  startedAt: string;
  rides: IncidentRideView[];
}

export interface DriverOption {
  id: string;
  nom_affichage: string;
}

function unique(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter((x): x is string => !!x)));
}

/** Chauffeurs actifs (pour le formulaire « Déclarer une indisponibilité »). */
export async function getActiveDriversForIncident(): Promise<DriverOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('drivers')
    .select('id, nom_affichage')
    .eq('actif', true)
    .eq('archive', false)
    .order('nom_affichage', { ascending: true })
    .limit(200);
  return (data as DriverOption[] | null) ?? [];
}

export async function getOpenIncidentsWithProposals(): Promise<IncidentWithProposals[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const incRes = await supabase
    .from('driver_incidents')
    .select('id, driver_id, type, nature, lieu, started_at')
    .is('resolved_at', null)
    .order('started_at', { ascending: false });
  const incidents = (incRes.data as IncidentRow[] | null) ?? [];
  if (incidents.length === 0) return [];

  const incidentDriverIds = unique(incidents.map((i) => i.driver_id));

  // Tous les chauffeurs actifs de l'org (labels + permis) en 1 requête.
  const driversRes = await supabase
    .from('drivers')
    .select('id, nom_affichage, type_permis')
    .eq('archive', false);
  const drivers = (driversRes.data as DriverRow[] | null) ?? [];
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  // Chauffeurs candidats = actifs, PAS en incident ouvert.
  const candidateDrivers = drivers.filter((d) => !incidentDriverIds.includes(d.id));
  const candidateIds = candidateDrivers.map((d) => d.id);

  // Courses restantes des chauffeurs en incident (réaffectables : futures,
  // validee/assignee — JAMAIS en_cours/terminee).
  const ridesRes = await supabase
    .from('rides')
    .select(
      'id, driver_id, transport_mode, pickup_lat, pickup_lng, pickup_address, scheduled_at, patient_id',
    )
    .in('driver_id', incidentDriverIds)
    .in('status', ['validee', 'assignee'])
    .gte('scheduled_at', nowIso)
    .eq('archive', false)
    .order('scheduled_at', { ascending: true });
  const rides = (ridesRes.data as RideRow[] | null) ?? [];

  // Charge + points de référence des candidats (courses futures affectées).
  const candidateLoad = new Map<string, number>();
  const candidateRefs = new Map<string, ReassignCandidate['refPoints']>();
  if (candidateIds.length > 0) {
    const candRidesRes = await supabase
      .from('rides')
      .select('driver_id, pickup_lat, pickup_lng, scheduled_at')
      .in('driver_id', candidateIds)
      .in('status', ['assignee', 'en_cours'])
      .gte('scheduled_at', nowIso)
      .eq('archive', false);
    for (const r of (candRidesRes.data as CandidateRideRow[] | null) ?? []) {
      candidateLoad.set(r.driver_id, (candidateLoad.get(r.driver_id) ?? 0) + 1);
      if (typeof r.pickup_lat === 'number' && typeof r.pickup_lng === 'number') {
        const list = candidateRefs.get(r.driver_id) ?? [];
        list.push({ scheduled_at: r.scheduled_at, lat: r.pickup_lat, lng: r.pickup_lng });
        candidateRefs.set(r.driver_id, list);
      }
    }
  }

  const candidates: ReassignCandidate[] = candidateDrivers.map((d) => ({
    driverId: d.id,
    driverLabel: d.nom_affichage,
    typePermis: d.type_permis ?? [],
    load: candidateLoad.get(d.id) ?? 0,
    refPoints: candidateRefs.get(d.id) ?? [],
  }));

  // Libellés patients en 1 lookup (patients_safe, RGPD).
  const patientIds = unique(rides.map((r) => r.patient_id));
  const patientLabels = new Map<string, string>();
  if (patientIds.length > 0) {
    const { data } = await supabase
      .from('patients_safe')
      .select('id, nom, prenom')
      .in('id', patientIds);
    for (const p of (data as { id: string; nom: string; prenom: string }[] | null) ?? []) {
      patientLabels.set(p.id, `${p.nom} ${p.prenom}`.trim());
    }
  }

  // Propositions par incident (un proposeReassignments par groupe de courses).
  return incidents.map((inc) => {
    const driverRides = rides.filter((r) => r.driver_id === inc.driver_id);
    const proposals = proposeReassignments(
      driverRides.map((r) => ({
        id: r.id,
        transport_mode: r.transport_mode,
        pickup_lat: r.pickup_lat,
        pickup_lng: r.pickup_lng,
        scheduled_at: r.scheduled_at,
      })),
      candidates,
    );
    const proposalByRide = new Map(proposals.map((p) => [p.rideId, p]));
    return {
      incidentId: inc.id,
      driverId: inc.driver_id,
      driverLabel: driverById.get(inc.driver_id)?.nom_affichage ?? 'Chauffeur',
      type: inc.type,
      nature: inc.nature,
      lieu: inc.lieu,
      startedAt: inc.started_at,
      rides: driverRides.map((r) => ({
        rideId: r.id,
        patientLabel: patientLabels.get(r.patient_id) ?? '',
        pickupAddress: r.pickup_address ?? '',
        scheduledAt: r.scheduled_at,
        transportMode: r.transport_mode,
        proposal: proposalByRide.get(r.id) ?? {
          rideId: r.id,
          candidates: [],
          best: null,
          reassignable: false,
        },
      })),
    };
  });
}
