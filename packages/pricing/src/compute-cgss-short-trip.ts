/**
 * Pricing stub Phase 04.7 — Haversine + fallback random (DEC-042).
 *
 * Ce module retourne un tarif fictif mais cohérent visuellement, basé sur
 * la distance Haversine pickup→dropoff quand les coordonnées sont
 * disponibles, ou un random pseudo-déterministe sinon. Préfigure le
 * calcul réel CGSS livré Phase 05.5 (DEC-021).
 *
 * **NE PAS** utiliser pour facturation réelle. L'UI doit afficher le badge
 * « DEMO » sur tout rendu (Surface A `PricingBreakdown`).
 *
 * Refs : DEC-042 LOCKED, Phase 04.7 PLAN-1 T1.1.
 */

export type TransportMode =
  | 'taxi_conventionne'
  | 'tpmr'
  | 'vsl'
  | 'ambulance';

export type Urgency = 'programmee' | 'urgente' | 'immediate';

export type PricingSource = 'haversine' | 'fallback_random';

export interface PricingInput {
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  /** ISO timestamp ; sert à déterminer la majoration nuit. */
  scheduled_at: string;
  transport_mode: TransportMode;
  urgency: Urgency;
}

export interface PricingResult {
  forfait_eur: number;
  distance_km: number | null;
  prix_km_eur: number | null;
  km_total_eur: number | null;
  majo_nuit_pct: number;
  majo_nuit_eur: number;
  supp_tpmr_eur: number;
  total_eur: number;
  source: PricingSource;
}

const FORFAIT_EUR = 4.2;
const PRIX_KM_EUR = 2.1;
const SUPP_TPMR_EUR = 5;
const MAJO_NUIT_PCT = 20;
const EARTH_RADIUS_KM = 6371;
const MIN_TOTAL = 10;
const MAX_TOTAL = 80;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNuit(iso: string): boolean {
  const h = new Date(iso).getUTCHours();
  return h >= 20 || h < 7;
}

function roundTo5cents(n: number): number {
  return Math.round(n * 20) / 20;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Fallback déterministe basé sur scheduled_at. Évite que deux affichages
 * successifs de la même course donnent des montants différents (perte
 * de crédibilité démo).
 */
function pseudoRandomFallback(input: PricingInput): number {
  const seed = new Date(input.scheduled_at).getTime() % 7919;
  const baseRange = input.urgency === 'immediate' ? 25 : 18;
  return baseRange + (seed % 22);
}

export function computeCgssShortTrip(input: PricingInput): PricingResult {
  const hasCoords =
    typeof input.pickup_lat === 'number' &&
    typeof input.pickup_lng === 'number' &&
    typeof input.dropoff_lat === 'number' &&
    typeof input.dropoff_lng === 'number';

  let distance_km: number | null = null;
  let prix_km_eur: number | null = null;
  let km_total_eur: number | null = null;
  let baseTotal: number;
  let source: PricingSource;

  if (hasCoords) {
    distance_km = haversineKm(
      input.pickup_lat as number,
      input.pickup_lng as number,
      input.dropoff_lat as number,
      input.dropoff_lng as number,
    );
    prix_km_eur = PRIX_KM_EUR;
    km_total_eur = roundTo5cents(distance_km * PRIX_KM_EUR);
    baseTotal = FORFAIT_EUR + km_total_eur;
    source = 'haversine';
  } else {
    baseTotal = pseudoRandomFallback(input);
    source = 'fallback_random';
  }

  const supp_tpmr_eur = input.transport_mode === 'tpmr' ? SUPP_TPMR_EUR : 0;
  const isMajoNuit = isNuit(input.scheduled_at);
  const majo_nuit_pct = isMajoNuit ? MAJO_NUIT_PCT : 0;
  const majo_nuit_eur = isMajoNuit
    ? roundTo5cents((baseTotal + supp_tpmr_eur) * (MAJO_NUIT_PCT / 100))
    : 0;
  const totalRaw = baseTotal + supp_tpmr_eur + majo_nuit_eur;
  const total_eur = roundTo5cents(clamp(totalRaw, MIN_TOTAL, MAX_TOTAL));

  return {
    forfait_eur: FORFAIT_EUR,
    distance_km,
    prix_km_eur,
    km_total_eur,
    majo_nuit_pct,
    majo_nuit_eur,
    supp_tpmr_eur,
    total_eur,
    source,
  };
}
