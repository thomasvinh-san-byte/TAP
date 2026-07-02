'use server';

/**
 * EXPRESS-03 (§5.14) — « affecter au plus proche disponible ».
 *
 * Action MINCE : orchestre des briques existantes, ne réimplémente RIEN.
 * Pour une course, charge les chauffeurs actifs (candidats) avec leur charge et
 * leurs points de référence (comme la replanification), puis délègue le scoring
 * à `proposeReassignments` (proximité Haversine + charge — DEC-160). Renvoie le
 * meilleur candidat ET les alternatives (le régulateur garde la main).
 *
 * PAS d'ETA (hors périmètre : dépend de la géoloc temps réel HDS, §5.17).
 * L'affectation passe par l'action existante `assignRideAction` (un seul chemin).
 */

import { z } from 'zod';
import {
  proposeReassignments,
  type ReassignCandidate,
  type ReassignTransportMode,
  type ScoredCandidate,
} from '@/lib/replanning/reassign';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { REGULATEUR_OR_DIRIGEANT } from './_shared';

export interface NearestProposal {
  best: ScoredCandidate | null;
  candidates: ScoredCandidate[];
  reassignable: boolean;
}

interface RideRow {
  id: string;
  transport_mode: ReassignTransportMode;
  pickup_lat: number | null;
  pickup_lng: number | null;
  scheduled_at: string;
}

interface DriverRow {
  id: string;
  nom_affichage: string;
  type_permis: string[] | null;
}

interface CandidateRideRow {
  driver_id: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  scheduled_at: string;
}

export async function proposeNearestDriversAction(
  rideId: string,
): Promise<{ data?: NearestProposal; error?: string }> {
  if (!z.string().uuid().safeParse(rideId).success) return { error: 'Course invalide.' };

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role)) {
    return { error: 'Accès non autorisé.' };
  }

  const rideRes = await ctx.supabase
    .from('rides')
    .select('id, transport_mode, pickup_lat, pickup_lng, scheduled_at')
    .eq('id', rideId)
    .maybeSingle();
  const ride = rideRes.data as RideRow | null;
  if (rideRes.error || !ride) return { error: 'Course introuvable.' };

  // Candidats = chauffeurs ACTIFS (status='actif', CHAUFFEUR-01). RLS scope l'org.
  const driversRes = await ctx.supabase
    .from('drivers')
    .select('id, nom_affichage, type_permis')
    .eq('status', 'actif');
  const drivers = (driversRes.data as DriverRow[] | null) ?? [];
  if (drivers.length === 0) {
    return { data: { best: null, candidates: [], reassignable: false } };
  }

  // Charge + points de référence (courses futures affectées) — pattern replanif.
  const driverIds = drivers.map((d) => d.id);
  const nowIso = new Date().toISOString();
  const candRidesRes = await ctx.supabase
    .from('rides')
    .select('driver_id, pickup_lat, pickup_lng, scheduled_at')
    .in('driver_id', driverIds)
    .in('status', ['assignee', 'en_cours'])
    .gte('scheduled_at', nowIso)
    .eq('archive', false);
  const load = new Map<string, number>();
  const refs = new Map<string, ReassignCandidate['refPoints']>();
  for (const r of (candRidesRes.data as CandidateRideRow[] | null) ?? []) {
    load.set(r.driver_id, (load.get(r.driver_id) ?? 0) + 1);
    if (typeof r.pickup_lat === 'number' && typeof r.pickup_lng === 'number') {
      const list = refs.get(r.driver_id) ?? [];
      list.push({ scheduled_at: r.scheduled_at, lat: r.pickup_lat, lng: r.pickup_lng });
      refs.set(r.driver_id, list);
    }
  }

  const candidates: ReassignCandidate[] = drivers.map((d) => ({
    driverId: d.id,
    driverLabel: d.nom_affichage,
    typePermis: d.type_permis ?? [],
    load: load.get(d.id) ?? 0,
    refPoints: refs.get(d.id) ?? [],
  }));

  const proposal = proposeReassignments(
    [
      {
        id: ride.id,
        transport_mode: ride.transport_mode,
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        scheduled_at: ride.scheduled_at,
      },
    ],
    candidates,
  )[0];

  return {
    data: {
      best: proposal?.best ?? null,
      candidates: proposal?.candidates ?? [],
      reassignable: proposal?.reassignable ?? false,
    },
  };
}
