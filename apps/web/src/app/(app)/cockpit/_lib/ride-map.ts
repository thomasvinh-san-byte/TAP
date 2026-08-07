import type { MapMarker, MapLine } from '@/components/map/map.client';
import { buildCoursePointPopupData, renderCoursePointPopupHtml } from './course-popup';
import { chronologicalOrder, isRideDone, type RideOrderSource } from './ride-order';
import { tourneeColor } from './driver-map-link';
import { formatReunionTime } from './unassigned-h1';
import type { CockpitRide } from './types';

/**
 * Construit les trajets des courses du jour pour la carte du cockpit : pour
 * chaque course GÉOCODÉE (départ + arrivée), un marqueur de départ (carré plein),
 * un marqueur d'arrivée (anneau creux) et une ligne droite entre les deux.
 *
 * Code couleur PAR TOURNÉE (COCKPIT-09) : les courses d'une même tournée partagent
 * une couleur stable de la palette partagée (daltonien-safe). La clé de tournée est
 * le chauffeur affecté (`driver_id`) ou, à défaut, le véhicule affecté
 * (`vehicle_id`) — l'application d'une optimisation pose le véhicule. On NE
 * détourne PAS la table de demandes groupées (sémantique B2B) : une tournée = les
 * courses d'un même chauffeur/véhicule ce jour-là. Les courses NON affectées
 * restent NEUTRES (distinctes) ; ainsi le passage « dispersées → regroupées » se
 * voit. La couleur n'est jamais le seul repère : forme, numéro d'ordre et libellé
 * de tournée dans l'aperçu portent aussi l'information.
 *
 * Les courses sans coordonnées complètes sont ignorées (non traçables) ; elles
 * restent visibles ailleurs dans le cockpit.
 */

export interface RideTrajectories {
  markers: MapMarker[];
  lines: MapLine[];
}

/**
 * Couleur NEUTRE (jeton de thème, DOM) : points d'une course TERMINÉE (estompée)
 * ou NON AFFECTÉE (pas encore de tournée). Les points d'une course affectée
 * prennent la couleur de leur tournée.
 */
export const COURSE_MARKER_COLOR = 'hsl(var(--muted-foreground))';

/**
 * Couleur NEUTRE des LIGNES non affectées / terminées. Hex en dur (le trait est
 * rendu en WebGL, qui ne résout pas les variables CSS) — gris neutre lisible en
 * clair comme en sombre.
 */
export const COURSE_LINE_NEUTRAL = '#94a3b8';

function isFiniteNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Clé de tournée : chauffeur affecté, sinon véhicule affecté, sinon aucune. */
function tourneeKeyOf(r: CockpitRide): string | null {
  return r.driver_id ?? r.vehicle_id ?? null;
}

/**
 * Libellé humain de la tournée (aperçu) : nom du chauffeur si affecté, sinon
 * immatriculation du véhicule. `null` si la course n'est pas affectée.
 */
function tourneeLabelOf(r: CockpitRide): string | null {
  if (r.driver_id) return r.driver?.nom_affichage?.trim() || 'Chauffeur';
  if (r.vehicle_id) {
    const imm = r.vehicle?.immatriculation?.trim();
    return imm ? `Véh. ${imm}` : 'Véhicule';
  }
  return null;
}

/** Vrai si la course a des coordonnées complètes (départ ET arrivée). */
export function rideIsGeocoded(r: CockpitRide): boolean {
  return (
    isFiniteNum(r.pickup_lat) &&
    isFiniteNum(r.pickup_lng) &&
    isFiniteNum(r.dropoff_lat) &&
    isFiniteNum(r.dropoff_lng)
  );
}

function patientLabel(r: CockpitRide): string {
  const p = r.patient;
  const name = p ? [p.nom, p.prenom].filter(Boolean).join(' ').trim() : '';
  return name || 'Patient';
}

export function buildRideTrajectories(
  rides: readonly CockpitRide[],
  // Source d'ordre remplaçable : chronologique aujourd'hui, séquence optimisée
  // demain (même signature) — sans réécrire les marqueurs.
  orderSource: RideOrderSource = chronologicalOrder,
): RideTrajectories {
  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  const order = orderSource(rides);

  for (const r of rides) {
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = r;
    // Type guards : narrow `number | null` → `number` sans `as`.
    if (
      !isFiniteNum(pickup_lat) ||
      !isFiniteNum(pickup_lng) ||
      !isFiniteNum(dropoff_lat) ||
      !isFiniteNum(dropoff_lng)
    ) {
      continue;
    }

    const done = isRideDone(r);
    const orderNum = order.get(r.id) ?? null;
    const tournee = tourneeLabelOf(r);
    // Couleur de TOURNÉE (stable) si la course est affectée ; sinon neutre. Une
    // course terminée passe en neutre (elle est estompée par ailleurs). C'est ce
    // qui rend visible « non affectée (neutre) → affectée (couleur de tournée) ».
    const tourneeKey = tourneeKeyOf(r);
    const tourneeHex = tourneeKey ? tourneeColor(tourneeKey).hex : null;
    const markerColor = done || !tourneeHex ? COURSE_MARKER_COLOR : tourneeHex;
    const lineColor = !done && tourneeHex ? tourneeHex : COURSE_LINE_NEUTRAL;
    const who = patientLabel(r);
    const scheduledLabel = formatReunionTime(r.scheduled_at) || null;

    markers.push({
      id: `${r.id}:start`,
      lat: pickup_lat,
      lng: pickup_lng,
      label: orderNum != null ? `Départ ${orderNum} — ${who}` : `Départ — ${who}`,
      color: markerColor,
      shape: 'start',
      // Numéro d'ordre de passage sur le départ actif (lisible, pastille pleine).
      // Les terminés n'en portent pas : l'ordre concerne ce qui reste à faire.
      badge: orderNum != null ? String(orderNum) : undefined,
      faded: done,
      // Point identifiable au clic (comme les chauffeurs) : patient + adresse de
      // prise en charge. `groupId` relie ce point à sa course (mise en évidence).
      groupId: r.id,
      popupHtml: renderCoursePointPopupHtml(
        buildCoursePointPopupData({
          kind: 'start',
          patient: who,
          address: r.pickup_address,
          scheduledLabel,
          order: orderNum,
          done,
          tournee,
          rideId: r.id,
        }),
      ),
    });
    markers.push({
      id: `${r.id}:end`,
      lat: dropoff_lat,
      lng: dropoff_lng,
      label: `Arrivée — ${r.dropoff_address ?? who}`,
      color: markerColor,
      shape: 'end',
      faded: done,
      groupId: r.id,
      popupHtml: renderCoursePointPopupHtml(
        buildCoursePointPopupData({
          kind: 'end',
          patient: who,
          address: r.dropoff_address,
          scheduledLabel,
          order: orderNum,
          done,
          tournee,
          rideId: r.id,
        }),
      ),
    });
    lines.push({
      id: r.id,
      from: { lat: pickup_lat, lng: pickup_lng },
      to: { lat: dropoff_lat, lng: dropoff_lng },
      color: lineColor,
      // Ligne d'une course terminée : estompée (opacité réduite) → « c'est fait »
      // sans disparaître.
      muted: done,
    });
  }

  return { markers, lines };
}
