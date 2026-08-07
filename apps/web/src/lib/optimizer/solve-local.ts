/**
 * Solveur local heuristique cluster-first / route-second (Phase 06.12).
 *
 * Remplace l'ancien microservice Python OR-Tools + mock (ADR-010 supersede
 * ADR-008/009). Cible : ≤ 500 courses, en pratique quelques dizaines —
 * volume où OR-Tools est disproportionné et l'heuristique quasi-optimale
 * pour des fenêtres horaires petites + horaires quasi-fixes (dialyse).
 *
 * Contrat préservé : produit exactement le même `SolveResponse` que
 * l'ancien service Python. Le client `@tap/optimizer-client` (zod
 * `SolveRequestSchema` / `SolveResponseSchema`) reste l'interface
 * canonique — `solveLocal()` est l'implémentation actuelle, réversible
 * via le contrat.
 *
 * Algorithme :
 *   1. Pré-filtre courses par compatibilité de fenêtre temporelle (port
 *      direct de `solver.py:_pre_filter_rides`).
 *   2. Apparie les courses 2 par 2 si fenêtres se chevauchent ET
 *      compatibilité transport_mode → vehicle.type ET capacité OK.
 *      Au-delà de 2 si capacité véhicule le permet.
 *   3. Ordonne le passage (`order`) par nearest-neighbor Haversine sur
 *      pickups puis dropoffs. Pas de 2-opt (volume trop petit pour gain
 *      tangible).
 *   4. Calcule `km_a_vide` = somme Haversine corrigée des trajets
 *      dropoff(i) → pickup(i+1) sans passager.
 *   5. `motif` court cohérent DEC-081 (« estimé »), `gain_km_a_vide`
 *      par groupement = économie vs 2 courses séparées.
 *
 * Tout est synchrone, pur (sauf calcul flottant), aucun effet de bord.
 */

import {
  CONTRACT_VERSION,
  type Groupement,
  type RideNode,
  type SolveRequest,
  type SolveResponse,
  type VehicleNode,
} from '@tap/optimizer-client';
import { distanceMatrix, haversineKm } from './haversine';

const TOLERANCE_PROGRAMMEE_S = 30 * 60;
const TOLERANCE_URGENTE_S = 60 * 60;
const TOLERANCE_IMMEDIATE_S = 15 * 60;

const REUNION_OFFSET_S = 4 * 3600;

interface TimeWindow {
  earliest: number;
  latest: number;
}

/**
 * Dérive la fenêtre horaire [earliest, latest] depuis `scheduled_at` + `urgency`.
 * Travaille en secondes depuis minuit UTC+4 (D-11). Réunion = UTC+4 sans DST.
 *
 * Exporté pour les tests Vitest (scénario 6).
 */
export function timeWindow(scheduledAtIso: string, urgency: RideNode['urgency']): TimeWindow {
  const dt = new Date(scheduledAtIso);
  const secsSinceMidnight = Math.floor((dt.getTime() / 1000 + REUNION_OFFSET_S) % 86400);
  const tolerance =
    urgency === 'urgente'
      ? TOLERANCE_URGENTE_S
      : urgency === 'immediate'
        ? TOLERANCE_IMMEDIATE_S
        : TOLERANCE_PROGRAMMEE_S;
  return {
    earliest: Math.max(0, secsSinceMidnight - tolerance),
    latest: Math.min(86400, secsSinceMidnight + tolerance),
  };
}

function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.earliest <= b.latest && b.earliest <= a.latest;
}

/**
 * Compatibilité transport_mode ↔ vehicle.type. Reprend la logique du mock et du
 * scénario 4 du pré-filtre solver.py (TPMR doit aller sur véhicule TPMR).
 */
const COMPATIBILITY: Record<RideNode['transport_mode'], ReadonlyArray<VehicleNode['type']>> = {
  taxi_conventionne: ['taxi'],
  vsl: ['vsl', 'taxi'],
  tpmr: ['tpmr'],
  ambulance: ['ambulance'],
};

function isVehicleCompatible(ride: RideNode, vehicle: VehicleNode): boolean {
  return COMPATIBILITY[ride.transport_mode].includes(vehicle.type);
}

/**
 * Pré-filtre les courses par compatibilité de fenêtres temporelles.
 * Une course est groupable si sa fenêtre chevauche au moins une autre fenêtre
 * d'une course du payload.
 */
function preFilterRides(rides: ReadonlyArray<RideNode>): {
  groupables: RideNode[];
  nonGroupees: string[];
} {
  if (rides.length <= 1) {
    return { groupables: [...rides], nonGroupees: [] };
  }
  const windows = rides.map((r) => timeWindow(r.scheduled_at, r.urgency));
  const compatibleWithAny = rides.map((_, i) => {
    for (let j = 0; j < rides.length; j += 1) {
      if (i !== j && windowsOverlap(windows[i]!, windows[j]!)) {
        return true;
      }
    }
    return false;
  });
  const groupables: RideNode[] = [];
  const nonGroupees: string[] = [];
  for (let i = 0; i < rides.length; i += 1) {
    if (compatibleWithAny[i]) groupables.push(rides[i]!);
    else nonGroupees.push(rides[i]!.id);
  }
  return { groupables, nonGroupees };
}

/**
 * Ordonne les courses d'un groupement par nearest-neighbor depuis le dépôt.
 * Insère pickup puis dropoff de chaque course dans l'ordre choisi — la
 * contrainte de précédence pickup→dropoff est respectée par construction.
 *
 * Retourne `{ order, kmAVide }` :
 *   - `order` : UUIDs dans l'ordre de passage — UNE entrée par course (n entrées
 *     pour n courses). La séquence de stops pickup→dropoff (2n) utilisée par le
 *     contrôle de détour est dérivée à la demande côté `buildGroupings`.
 *   - `kmAVide` : km Haversine corrigés sans passager (entre un dropoff et
 *     le pickup suivant).
 */
function orderGroupNearestNeighbor(
  rides: ReadonlyArray<RideNode>,
  depot: readonly [number, number],
  correctionFactor: number,
): { order: string[]; kmAVide: number } {
  if (rides.length === 0) return { order: [], kmAVide: 0 };

  // Coordonnées : [depot, pickup_0, dropoff_0, pickup_1, dropoff_1, ...]
  const coords: Array<[number, number]> = [[...depot]];
  rides.forEach((r) => {
    coords.push([...r.pickup]);
    coords.push([...r.dropoff]);
  });
  const dm = distanceMatrix(coords, correctionFactor);

  // Choisir l'ordre des pickups par nearest-neighbor depuis le dépôt.
  const remaining = rides.map((_, idx) => idx);
  const orderedRideIdx: number[] = [];
  let currentNode = 0;
  while (remaining.length > 0) {
    let bestRideIdx = remaining[0]!;
    let bestDist = Infinity;
    for (const idx of remaining) {
      const pickupNode = 1 + 2 * idx;
      const d = dm[currentNode]![pickupNode]!;
      if (d < bestDist) {
        bestDist = d;
        bestRideIdx = idx;
      }
    }
    orderedRideIdx.push(bestRideIdx);
    remaining.splice(remaining.indexOf(bestRideIdx), 1);
    currentNode = 2 + 2 * bestRideIdx;
  }

  // Construire l'ordre des UUIDs et calculer km à vide
  // (somme des distances dropoff(i) → pickup(i+1), 0 si une seule course).
  const order: string[] = [];
  let kmAVide = 0;
  for (let i = 0; i < orderedRideIdx.length; i += 1) {
    const rideIdx = orderedRideIdx[i]!;
    const ride = rides[rideIdx]!;
    // UNE entrée par course (ordre de passage). Le km à vide ci-dessous itère sur
    // `orderedRideIdx`, pas sur `order` — il n'est pas affecté.
    order.push(ride.id);
    if (i + 1 < orderedRideIdx.length) {
      const dropoffNode = 2 + 2 * rideIdx;
      const nextPickupNode = 1 + 2 * orderedRideIdx[i + 1]!;
      kmAVide += dm[dropoffNode]![nextPickupNode]!;
    }
  }
  return { order, kmAVide };
}

// --------------------------------------------------------------------------
// Conformité — détour réglementaire du transport partagé (DEC-169)
// --------------------------------------------------------------------------
//
// Décret n°2025-202 du 28/02/2025 (postérieur au CdG) : pour un transport
// partagé conventionné, le détour ne doit pas dépasser 10 km par personne À
// PARTIR DE LA 2ᵉ, dans la limite de 30 km au TOTAL. Au-delà, le transport
// partagé n'est PAS remboursable par la CGSS. Source : Service-Public.fr
// (décret 2025-202), ameli.fr.
//
// Approximation V1 : distances Haversine × facteur de correction (cohérent avec
// le reste du solveur, qui n'a pas de routing réel). La précision exacte montera
// avec le routing/géoloc HDS — la contrainte reste une borne PRUDENTE en V1.
// NB : le solveur ordonne aujourd'hui les passages en séquence pickup→dropoff
// par patient (détour ≈ 0) ; ce filtre est un garde-fou de conformité qui mord
// dès que la route entrelace réellement les prises en charge.

/** Détour maximal par personne (km), dès la 2ᵉ — décret 2025-202. */
export const DETOUR_MAX_PAR_PERSONNE_KM = 10;
/** Détour cumulé maximal du groupement (km) — décret 2025-202. */
export const DETOUR_MAX_TOTAL_KM = 30;

export interface DetourStop {
  rideId: string;
  kind: 'pickup' | 'dropoff';
}

export interface DetourCheck {
  /** false = groupement non remboursable (dépasse une limite du décret). */
  compliant: boolean;
  totalDetourKm: number;
  perRideDetourKm: Record<string, number>;
}

/**
 * Vérifie la conformité du détour d'un groupement ORDONNÉ vis-à-vis du décret
 * 2025-202. `stops` = séquence réelle de passage (pickup/dropoff de chaque
 * course). Le 1ᵉʳ patient pris en charge (1ᵉʳ `pickup` de la séquence) est la
 * RÉFÉRENCE : exempt de la limite individuelle et exclu du total (« à partir de
 * la 2ᵉ personne »).
 */
export function checkRegulatoryDetour(
  rides: ReadonlyArray<RideNode>,
  stops: ReadonlyArray<DetourStop>,
  correctionFactor: number,
): DetourCheck {
  const rideById = new Map(rides.map((r) => [r.id, r] as const));
  const coordOf = (s: DetourStop): readonly [number, number] => {
    const r = rideById.get(s.rideId)!;
    return s.kind === 'pickup' ? r.pickup : r.dropoff;
  };

  // Distance cumulée le long de la séquence (cum[i] = km du stop 0 au stop i).
  const cum: number[] = [0];
  for (let i = 1; i < stops.length; i += 1) {
    const a = coordOf(stops[i - 1]!);
    const b = coordOf(stops[i]!);
    cum.push(cum[i - 1]! + haversineKm(a[0], a[1], b[0], b[1]) * correctionFactor);
  }

  const firstPickupRideId = stops.find((s) => s.kind === 'pickup')?.rideId;

  const perRideDetourKm: Record<string, number> = {};
  let totalDetourKm = 0;
  let compliant = true;

  for (const r of rides) {
    const pIdx = stops.findIndex((s) => s.rideId === r.id && s.kind === 'pickup');
    const dIdx = stops.findIndex((s) => s.rideId === r.id && s.kind === 'dropoff');
    if (pIdx === -1 || dIdx === -1 || dIdx < pIdx) continue;
    const inRoute = cum[dIdx]! - cum[pIdx]!;
    const direct =
      haversineKm(r.pickup[0], r.pickup[1], r.dropoff[0], r.dropoff[1]) * correctionFactor;
    const detour = Math.max(0, inRoute - direct);
    perRideDetourKm[r.id] = Math.round(detour * 100) / 100;
    if (r.id === firstPickupRideId) continue; // 1ᵉʳ patient = référence (exempt).
    totalDetourKm += detour;
    if (detour > DETOUR_MAX_PAR_PERSONNE_KM) compliant = false;
  }
  if (totalDetourKm > DETOUR_MAX_TOTAL_KM) compliant = false;

  return {
    compliant,
    totalDetourKm: Math.round(totalDetourKm * 100) / 100,
    perRideDetourKm,
  };
}

/**
 * Apparie les courses 2 par 2 (extensible à n si capacité véhicule OK) sur un
 * véhicule compatible. Greedy : on prend la première course non assignée, on
 * cherche la course suivante dont la fenêtre chevauche, on alloue au premier
 * véhicule libre et compatible.
 *
 * Au-delà de 2 courses dans un même groupement : la capacité doit le permettre
 * (places_assises ≥ ride_ids.length pour la séquence d'embarquement
 * pickup→pickup→dropoff→dropoff). Si capacité = 1, on reste à 2 courses
 * séquentielles (le solveur Python avait la même limite via dimension Capacity).
 */
function buildGroupings(
  rides: ReadonlyArray<RideNode>,
  vehicles: ReadonlyArray<VehicleNode>,
  depot: readonly [number, number],
  correctionFactor: number,
): {
  groupements: Groupement[];
  ridesIsolees: string[];
  kmAVideTotal: number;
} {
  const used = new Set<string>();
  const assignedVehicles = new Set<string>();
  const groupements: Groupement[] = [];
  let kmAVideTotal = 0;
  // DEC-169 — traçabilité : nb de groupements écartés pour détour réglementaire.
  let ecartesDetour = 0;
  const windows = rides.map((r) => timeWindow(r.scheduled_at, r.urgency));

  for (let i = 0; i < rides.length; i += 1) {
    const r1 = rides[i]!;
    if (used.has(r1.id)) continue;
    const w1 = windows[i]!;

    // Cherche un second compagnon : fenêtre chevauche + même véhicule compatible.
    let partnerIdx = -1;
    let chosenVehicle: VehicleNode | undefined;
    for (let j = i + 1; j < rides.length; j += 1) {
      const r2 = rides[j]!;
      if (used.has(r2.id)) continue;
      if (!windowsOverlap(w1, windows[j]!)) continue;
      const vehicle = vehicles.find(
        (v) =>
          !assignedVehicles.has(v.id) && isVehicleCompatible(r1, v) && isVehicleCompatible(r2, v),
      );
      if (vehicle) {
        partnerIdx = j;
        chosenVehicle = vehicle;
        break;
      }
    }
    if (partnerIdx === -1 || !chosenVehicle) continue;

    const group: RideNode[] = [r1, rides[partnerIdx]!];
    used.add(r1.id);
    used.add(rides[partnerIdx]!.id);

    // Extension opportuniste à n>2 si capacité véhicule le permet. La capacité
    // limite le nombre de passagers SIMULTANÉS ; en séquence pickup→dropoff→
    // pickup→dropoff (notre nearest-neighbor) on ne dépasse jamais 1.
    // L'ancien solveur Python avait la même propriété via Capacity. On reste
    // donc à 2 par défaut et on n'étend que si places_assises >= 3 ET que des
    // courses additionnelles ont une fenêtre chevauchant les 2 premières.
    if (chosenVehicle.places_assises >= 3) {
      for (let k = partnerIdx + 1; k < rides.length; k += 1) {
        const rk = rides[k]!;
        if (used.has(rk.id)) continue;
        if (!isVehicleCompatible(rk, chosenVehicle)) continue;
        const overlapsAll = group.every((g) => {
          const gw = windows[rides.indexOf(g)]!;
          return windowsOverlap(gw, windows[k]!);
        });
        if (!overlapsAll) continue;
        if (group.length + 1 > chosenVehicle.places_assises) break;
        group.push(rk);
        used.add(rk.id);
      }
    }

    const { order, kmAVide } = orderGroupNearestNeighbor(group, depot, correctionFactor);

    // DEC-169 — conformité détour (décret 2025-202) AVANT de committer le
    // groupement. `order` = [pickup, dropoff] par course → stops dérivés. Si le
    // détour dépasse les limites, le partage n'est pas remboursable : on REJETTE
    // le groupement entier (option a, déterministe) → les courses redeviennent
    // individuelles (retirées de `used`, sans consommer de véhicule).
    // `order` porte une entrée par course ; la conformité du détour raisonne sur
    // la séquence de STOPS pickup→dropoff par course — on l'étend ici (résultat
    // identique à l'ancienne séquence 2N, sans dupliquer l'ordre stocké/affiché).
    const stops: DetourStop[] = order.flatMap((rideId) => [
      { rideId, kind: 'pickup' as const },
      { rideId, kind: 'dropoff' as const },
    ]);
    if (!checkRegulatoryDetour(group, stops, correctionFactor).compliant) {
      group.forEach((g) => used.delete(g.id));
      ecartesDetour += 1;
      continue;
    }

    assignedVehicles.add(chosenVehicle.id);

    // Gain km à vide : distance approximative des courses séparées (2 trajets
    // depuis le dépôt vers chaque pickup) − km à vide réel du groupement.
    // Approximation cohérente avec l'esprit du solveur Python.
    const standalone = group.reduce(
      (sum, r) =>
        sum + haversineKm(depot[0], depot[1], r.pickup[0], r.pickup[1]) * correctionFactor,
      0,
    );
    const gain = Math.max(0, standalone - kmAVide);

    groupements.push({
      vehicle_id: chosenVehicle.id,
      ride_ids: group.map((r) => r.id),
      order,
      motif: 'compatibilite horaire et trajet commun',
      gain_km_a_vide: Math.round(gain * 100) / 100,
    });
    kmAVideTotal += kmAVide;
  }

  if (ecartesDetour > 0) {
    // D-04 : transparence sans bloquer (le détour réglementaire a écarté des
    // groupements qui auraient été non remboursables par la CGSS).
    console.info(
      `[solveLocal] ${ecartesDetour} groupement(s) écarté(s) : détour réglementaire (décret 2025-202).`,
    );
  }
  const ridesIsolees = rides.filter((r) => !used.has(r.id)).map((r) => r.id);
  return {
    groupements,
    ridesIsolees,
    kmAVideTotal: Math.round(kmAVideTotal * 100) / 100,
  };
}

/**
 * Solveur local heuristique. Entrée et sortie strictement conformes au
 * contrat partagé `@tap/optimizer-client` (zod `SolveRequestSchema` /
 * `SolveResponseSchema`).
 */
export function solveLocal(req: SolveRequest): SolveResponse {
  const { rides, vehicles, depot, correction_factor } = req;
  if (rides.length === 0 || vehicles.length === 0) {
    return {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: rides.map((r) => r.id),
      rides_exclues_ids: [],
      km_a_vide_estimes: 0,
    };
  }

  const { groupables, nonGroupees } = preFilterRides(rides);
  if (groupables.length < 2) {
    return {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: rides.map((r) => r.id),
      rides_exclues_ids: [],
      km_a_vide_estimes: 0,
    };
  }

  const { groupements, ridesIsolees, kmAVideTotal } = buildGroupings(
    groupables,
    vehicles,
    depot,
    correction_factor,
  );

  return {
    contract_version: CONTRACT_VERSION,
    groupements,
    rides_non_groupees_ids: [...ridesIsolees, ...nonGroupees],
    rides_exclues_ids: [],
    km_a_vide_estimes: kmAVideTotal,
  };
}
