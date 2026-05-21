/**
 * Moteur de tarification CGSS court trajet — Phase 05.5 (DEC-056..061).
 *
 * Remplace le stub Phase 04.7 (DEC-042). Conforme à la convention-cadre
 * nationale CNAM/taxi applicable 2026.
 *
 * Fonction PURE : la grille tarifaire est passée en paramètre (DEC-057)
 * → testable 100 % branches Vitest sans BDD. AUCUNE valeur tarifaire
 * hardcodée — tout vient de `grid`.
 *
 * Périmètre V1.5 (DEC-058) : monopatient. Transport partagé, abattements,
 * retour à vide, forfait Grande Ville = Phase 06.
 *
 * Refs : DEC-056 Haversine×facteur, DEC-057 grille paramètre,
 * DEC-058 monopatient, DEC-059 majoration Indian/Reunion, DEC-061 result.
 */

export type TransportMode = 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';
export type DistanceMethod = 'haversine_corrige' | 'unavailable';
export type MajorationMotif = 'nuit' | 'weekend' | 'ferie' | null;

/** Grille tarifaire — image d'une ligne `tariff_grids` (DEC-057). */
export interface TariffGrid {
  forfait_eur: number;
  km_inclus: number;
  prix_km_eur: number;
  supplement_drom_eur: number;
  supplement_tpmr_eur: number;
  majoration_pct: number;
  facteur_correction_routier: number;
  arrondi_eur: number;
}

export interface PricingInput {
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  /** ISO timestamp de la prise en charge. */
  scheduled_at: string;
  transport_mode: TransportMode;
  /** Jours fériés 974 au format YYYY-MM-DD (table holidays_974, DEC-059). */
  holidays974: Set<string>;
}

export interface PricingResult {
  forfait_eur: number;
  distance_km: number | null;
  distance_method: DistanceMethod;
  km_factures: number | null;
  prix_km_eur: number | null;
  km_total_eur: number | null;
  supplement_drom_eur: number;
  supplement_tpmr_eur: number;
  majoration_pct: number;
  majoration_motif: MajorationMotif;
  majoration_eur: number;
  total_eur: number;
}

const EARTH_RADIUS_KM = 6371;
/** Réunion = UTC+4, sans heure d'été (DST). Décalage fixe. */
const REUNION_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Arrondi au pas `step` (ex. 0,05 €). */
function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

interface ReunionLocal {
  isoDate: string;
  hour: number;
  /** 0 = dimanche … 6 = samedi. */
  weekday: number;
}

/**
 * Convertit un ISO timestamp en heure locale Réunion (UTC+4, pas de DST).
 * CORRIGE le bug du stub Phase 04.7 (`getUTCHours` au lieu de l'heure 974).
 */
function toReunionLocal(iso: string): ReunionLocal {
  const shifted = new Date(new Date(iso).getTime() + REUNION_UTC_OFFSET_MS);
  return {
    isoDate: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Détermine la majoration applicable (DEC-059) — UNE SEULE, non-cumulable.
 * Priorité : férié > weekend > nuit.
 */
function resolveMajorationMotif(local: ReunionLocal, holidays974: Set<string>): MajorationMotif {
  if (holidays974.has(local.isoDate)) return 'ferie';
  if (local.weekday === 0) return 'weekend';
  if (local.weekday === 6 && local.hour >= 12) return 'weekend';
  if (local.hour >= 20 || local.hour < 8) return 'nuit';
  return null;
}

/**
 * Calcule le tarif à partir d'une distance déjà connue (corrigée routier).
 *
 * Cœur de calcul partagé : `computeCgssShortTrip` l'appelle après le
 * Haversine ; le simulateur admin l'appelle directement avec une distance
 * saisie. Fonction PURE.
 *
 * @param distance_km distance routière corrigée, ou null si indisponible.
 */
export function computeCgssFromDistance(
  distance_km: number | null,
  params: {
    scheduled_at: string;
    transport_mode: TransportMode;
    holidays974: Set<string>;
  },
  grid: TariffGrid,
): PricingResult {
  let km_factures: number | null = null;
  let prix_km_eur: number | null = null;
  let km_total_eur: number | null = null;
  const distance_method: DistanceMethod =
    distance_km === null ? 'unavailable' : 'haversine_corrige';

  if (distance_km !== null) {
    km_factures = Math.max(0, distance_km - grid.km_inclus);
    prix_km_eur = grid.prix_km_eur;
    km_total_eur = roundTo(km_factures * grid.prix_km_eur, grid.arrondi_eur);
  }

  const supplement_drom_eur = grid.supplement_drom_eur;
  const supplement_tpmr_eur = params.transport_mode === 'tpmr' ? grid.supplement_tpmr_eur : 0;

  const majoration_motif = resolveMajorationMotif(
    toReunionLocal(params.scheduled_at),
    params.holidays974,
  );
  const baseMajorable =
    grid.forfait_eur + (km_total_eur ?? 0) + supplement_drom_eur + supplement_tpmr_eur;
  const majoration_pct = majoration_motif ? grid.majoration_pct : 0;
  const majoration_eur = majoration_motif
    ? roundTo((baseMajorable * majoration_pct) / 100, grid.arrondi_eur)
    : 0;

  const total_eur = roundTo(
    grid.forfait_eur +
      (km_total_eur ?? 0) +
      supplement_drom_eur +
      supplement_tpmr_eur +
      majoration_eur,
    grid.arrondi_eur,
  );

  return {
    forfait_eur: grid.forfait_eur,
    distance_km,
    distance_method,
    km_factures,
    prix_km_eur,
    km_total_eur,
    supplement_drom_eur,
    supplement_tpmr_eur,
    majoration_pct,
    majoration_motif,
    majoration_eur,
    total_eur,
  };
}

export function computeCgssShortTrip(input: PricingInput, grid: TariffGrid): PricingResult {
  const hasCoords =
    typeof input.pickup_lat === 'number' &&
    typeof input.pickup_lng === 'number' &&
    typeof input.dropoff_lat === 'number' &&
    typeof input.dropoff_lng === 'number';

  let distance_km: number | null = null;
  if (hasCoords) {
    const haversine = haversineKm(
      input.pickup_lat as number,
      input.pickup_lng as number,
      input.dropoff_lat as number,
      input.dropoff_lng as number,
    );
    distance_km = haversine * grid.facteur_correction_routier;
  }

  return computeCgssFromDistance(
    distance_km,
    {
      scheduled_at: input.scheduled_at,
      transport_mode: input.transport_mode,
      holidays974: input.holidays974,
    },
    grid,
  );
}
