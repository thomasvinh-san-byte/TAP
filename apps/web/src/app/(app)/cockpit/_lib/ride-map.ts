import type { MapMarker, MapLine } from '@/components/map/map.client';
import { getGroupColor } from '../optimisation/_lib/group-colors';
import { buildCoursePointPopupData, renderCoursePointPopupHtml } from './course-popup';
import { chronologicalOrder, isRideDone, type RideOrderSource } from './ride-order';
import { formatReunionTime } from './unassigned-h1';
import type { CockpitRide } from './types';

/**
 * Construit les trajets des courses du jour pour la carte du cockpit : pour
 * chaque course GÉOCODÉE (départ + arrivée), un marqueur de départ (carré plein),
 * un marqueur d'arrivée (anneau creux) et une ligne droite entre les deux.
 *
 * Code couleur PAR COURSE (rang), via la palette de groupements partagée
 * (daltonien-safe). On ne colore PAS par groupement : les groupements sont
 * produits par l'optimiseur (autre écran, à la demande) et n'existent pas sur le
 * cockpit au repos. Colorer par chauffeur n'aurait pas de sens ici non plus : les
 * courses du jour à regrouper sont non affectées (`driver_id` nul).
 *
 * Les courses sans coordonnées complètes sont ignorées (non traçables) ; elles
 * restent visibles ailleurs dans le cockpit.
 */

export interface RideTrajectories {
  markers: MapMarker[];
  lines: MapLine[];
}

/**
 * Couleur NEUTRE (jeton de thème) : utilisée pour les points d'une course
 * TERMINÉE (estompée). Les points ACTIFS, eux, prennent la couleur vive de leur
 * course pour bien ressortir du fond — la forme (carré/anneau) et le numéro
 * d'ordre portent aussi l'information, jamais la couleur seule.
 */
export const COURSE_MARKER_COLOR = 'hsl(var(--muted-foreground))';

function isFiniteNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
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
  let rank = 0;

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

    // Couleur vive stable par course (palette daltonien-safe). Les points ACTIFS la
    // portent pour ressortir ; les TERMINÉS passent en neutre + estompés.
    const courseColor = getGroupColor(rank).hex;
    rank += 1;
    const done = isRideDone(r);
    const orderNum = order.get(r.id) ?? null;
    const markerColor = done ? COURSE_MARKER_COLOR : courseColor;
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
        }),
      ),
    });
    lines.push({
      id: r.id,
      from: { lat: pickup_lat, lng: pickup_lng },
      to: { lat: dropoff_lat, lng: dropoff_lng },
      color: courseColor,
      // Ligne d'une course terminée : estompée (opacité réduite) → « c'est fait »
      // sans disparaître.
      muted: done,
    });
  }

  return { markers, lines };
}
