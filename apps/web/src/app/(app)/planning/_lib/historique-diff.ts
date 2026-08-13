import { RIDE_CANCELLED_STATUSES } from '@tap/shared';

/**
 * Comparaison PRÉVU (instantané figé à la validation, lot D) vs RÉALISÉ (état
 * courant des courses) — Module 5.12 lot E. Logique PURE et testable.
 *
 * HONNÊTETÉ : on ne mesure que ce qui est réellement dérivable.
 *   - ajoutées   : course présente au réalisé, absente de l'instantané.
 *   - annulées   : course de l'instantané désormais annulée (ou disparue).
 *   - réassignées: course commune dont le chauffeur a changé.
 *   - retards    : course commune démarrée (started_at) après l'heure prévue
 *                  au-delà d'un seuil. SANS `started_at`, aucun retard affirmé
 *                  (pas de retard inventé). Sans planning validé, l'appelant
 *                  n'a pas d'instantané → il signale « aucun planning validé »
 *                  plutôt que d'inventer une comparaison.
 */

const CANCELLED = new Set<string>(RIDE_CANCELLED_STATUSES);

/** Seuil de retard (minutes) au-delà duquel un démarrage est compté en retard. */
export const RETARD_THRESHOLD_MINUTES = 15;

export interface PrevuRow {
  ride_id: string;
  driver_id: string | null;
  scheduled_at: string;
  status: string;
}

export interface RealiseRow {
  id: string;
  driver_id: string | null;
  status: string;
  scheduled_at: string;
  started_at: string | null;
}

export interface EcartCourse {
  ride_id: string;
}

export interface EcartReassignee {
  ride_id: string;
  from_driver_id: string | null;
  to_driver_id: string | null;
}

export interface EcartRetard {
  ride_id: string;
  minutes: number;
}

export interface HistoriqueDiff {
  prevuCount: number;
  realiseCount: number;
  ajoutees: EcartCourse[];
  annulees: EcartCourse[];
  reassignees: EcartReassignee[];
  retards: EcartRetard[];
}

function delayMinutes(scheduledAt: string, startedAt: string): number {
  const s = new Date(scheduledAt).getTime();
  const t = new Date(startedAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(t)) return 0;
  return Math.round((t - s) / 60000);
}

export function computeHistoriqueDiff(
  prevu: PrevuRow[],
  realise: RealiseRow[],
  thresholdMinutes: number = RETARD_THRESHOLD_MINUTES,
): HistoriqueDiff {
  const prevuById = new Map(prevu.map((p) => [p.ride_id, p]));
  const realiseById = new Map(realise.map((r) => [r.id, r]));

  const ajoutees: EcartCourse[] = [];
  const retards: EcartRetard[] = [];
  for (const r of realise) {
    if (!prevuById.has(r.id) && !CANCELLED.has(r.status)) ajoutees.push({ ride_id: r.id });
    if (r.started_at) {
      const m = delayMinutes(r.scheduled_at, r.started_at);
      if (m > thresholdMinutes) retards.push({ ride_id: r.id, minutes: m });
    }
  }

  const annulees: EcartCourse[] = [];
  const reassignees: EcartReassignee[] = [];
  for (const p of prevu) {
    const r = realiseById.get(p.ride_id);
    if (!r || CANCELLED.has(r.status)) {
      annulees.push({ ride_id: p.ride_id });
      continue;
    }
    if ((p.driver_id ?? null) !== (r.driver_id ?? null)) {
      reassignees.push({
        ride_id: p.ride_id,
        from_driver_id: p.driver_id ?? null,
        to_driver_id: r.driver_id ?? null,
      });
    }
  }

  return {
    prevuCount: prevu.length,
    realiseCount: realise.length,
    ajoutees,
    annulees,
    reassignees,
    retards,
  };
}
