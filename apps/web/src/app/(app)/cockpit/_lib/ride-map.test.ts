import { describe, it, expect } from 'vitest';
import {
  buildRideTrajectories,
  rideIsGeocoded,
  COURSE_MARKER_COLOR,
  COURSE_LINE_NEUTRAL,
} from './ride-map';
import { tourneeColor, driverColor } from './driver-map-link';
import type { CockpitRide } from './types';

function ride(over: Partial<CockpitRide>): CockpitRide {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    scheduled_at: '2026-05-22T06:30:00Z',
    status: 'validee',
    pickup_address: '30 Rue des Bons-Enfants, 97410 Saint-Pierre',
    dropoff_address: 'Dialyse Sud Le Tampon, 97430 Le Tampon',
    pickup_lat: -21.3388,
    pickup_lng: 55.4802,
    dropoff_lat: -21.2788,
    dropoff_lng: 55.5158,
    driver_id: null,
    patient: { nom: 'Lebon', prenom: 'Bernard' },
    driver: null,
    ...over,
  };
}

describe('buildRideTrajectories', () => {
  it('produit départ (carré) + arrivée (anneau) + ligne pour une course géocodée', () => {
    const { markers, lines } = buildRideTrajectories([ride({ id: 'r1' })]);

    expect(lines).toHaveLength(1);
    expect(markers).toHaveLength(2);

    const start = markers.find((m) => m.shape === 'start');
    const end = markers.find((m) => m.shape === 'end');
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    // Départ = pickup, arrivée = dropoff.
    expect([start!.lat, start!.lng]).toEqual([-21.3388, 55.4802]);
    expect([end!.lat, end!.lng]).toEqual([-21.2788, 55.5158]);
    // Libellés sans dépendre de la couleur (départ/arrivée explicites).
    expect(start!.label).toContain('Départ');
    expect(end!.label).toContain('Arrivée');

    // Course NON affectée (driver/vehicle nuls) : neutre — c'est l'état « avant »,
    // dispersé, qui contraste avec les tournées colorées « après ».
    expect(start!.color).toBe(COURSE_MARKER_COLOR);
    expect(end!.color).toBe(COURSE_MARKER_COLOR);
    expect(lines[0]!.color).toBe(COURSE_LINE_NEUTRAL);
    // Départ actif numéroté (ordre de passage), non estompé.
    expect(start!.badge).toBe('1');
    expect(start!.faded).toBeFalsy();
    expect(lines[0]!.muted).toBeFalsy();
    expect(lines[0]!.from).toEqual({ lat: -21.3388, lng: 55.4802 });
    expect(lines[0]!.to).toEqual({ lat: -21.2788, lng: 55.5158 });
  });

  it('regroupe par tournée : même chauffeur → même couleur ; = la couleur d’identité', () => {
    const driverId = 'd0000000-0000-0000-0000-000000000001';
    const { markers, lines } = buildRideTrajectories([
      ride({ id: 'a', driver_id: driverId, driver: { nom_affichage: 'Vergoz Jean' } }),
      ride({ id: 'b', driver_id: driverId, driver: { nom_affichage: 'Vergoz Jean' } }),
    ]);
    const expected = tourneeColor(driverId).hex;
    // Les deux courses du même chauffeur partagent la couleur de tournée…
    expect(markers.every((m) => m.color === expected)).toBe(true);
    expect(lines.every((l) => l.color === expected)).toBe(true);
    // …et cette couleur est bien la couleur d'identité du chauffeur (même clé).
    expect(expected).toBe(driverColor(driverId).hex);
    // Le regroupement ne repose pas sur la couleur seule : l'aperçu nomme la tournée.
    expect(markers[0]!.popupHtml).toContain('Tournée · Vergoz Jean');
  });

  it('tournée par VÉHICULE à défaut de chauffeur (application optimisation = véhicule)', () => {
    const vehId = 'v0000000-0000-0000-0000-000000000009';
    const { markers } = buildRideTrajectories([
      ride({ id: 'a', vehicle_id: vehId, vehicle: { immatriculation: 'AB-123-CD' } }),
    ]);
    expect(markers[0]!.color).toBe(tourneeColor(vehId).hex);
    expect(markers[0]!.popupHtml).toContain('Tournée · Véh. AB-123-CD');
  });

  it('numérote les départs actifs dans l’ordre chronologique (heure programmée)', () => {
    const { markers } = buildRideTrajectories([
      ride({ id: 'midi', scheduled_at: '2026-05-22T12:00:00Z' }),
      ride({ id: 'tot', scheduled_at: '2026-05-22T06:00:00Z' }),
    ]);
    const badgeOf = (rideId: string): string | undefined =>
      markers.find((m) => m.id === `${rideId}:start`)?.badge;
    expect(badgeOf('tot')).toBe('1');
    expect(badgeOf('midi')).toBe('2');
  });

  it('estompe les courses terminées : points neutres + faded, ligne muted, sans numéro', () => {
    const { markers, lines } = buildRideTrajectories([ride({ id: 'done', status: 'terminee' })]);
    const start = markers.find((m) => m.shape === 'start');
    const end = markers.find((m) => m.shape === 'end');
    expect(start!.color).toBe(COURSE_MARKER_COLOR);
    expect(end!.color).toBe(COURSE_MARKER_COLOR);
    expect(start!.faded).toBe(true);
    expect(end!.faded).toBe(true);
    // Terminée = hors numérotation (l'ordre concerne ce qui reste à faire).
    expect(start!.badge).toBeUndefined();
    expect(lines[0]!.muted).toBe(true);
  });

  it('chaque point de course porte un popup identifiant (patient + adresse) et son groupe', () => {
    const { markers } = buildRideTrajectories([ride({ id: 'r1' })]);
    const start = markers.find((m) => m.shape === 'start');
    const end = markers.find((m) => m.shape === 'end');

    // Départ : patient + adresse de prise en charge.
    expect(start!.popupHtml).toContain('Départ');
    expect(start!.popupHtml).toContain('Lebon Bernard');
    expect(start!.popupHtml).toContain('Saint-Pierre'); // pickup_address
    // Arrivée : lieu de soins / adresse de destination.
    expect(end!.popupHtml).toContain('Arrivée');
    expect(end!.popupHtml).toContain('Le Tampon'); // dropoff_address

    // `groupId` = id de la course, partagé départ/arrivée → relie les deux points
    // (et cible la ligne pour la mise en évidence).
    expect(start!.groupId).toBe('r1');
    expect(end!.groupId).toBe('r1');
  });

  it('ignore proprement les courses sans coordonnées complètes', () => {
    const rides: CockpitRide[] = [
      ride({ id: 'ok' }),
      ride({ id: 'no-pickup', pickup_lat: null, pickup_lng: null }),
      ride({ id: 'no-dropoff', dropoff_lat: null }),
    ];
    expect(rideIsGeocoded(rides[1]!)).toBe(false);
    const { markers, lines } = buildRideTrajectories(rides);
    // Seule la course géocodée est tracée.
    expect(lines).toHaveLength(1);
    expect(markers).toHaveLength(2);
  });

  it('distingue affectée (couleur de tournée) et non affectée (neutre)', () => {
    const driverId = 'd0000000-0000-0000-0000-000000000002';
    const { markers } = buildRideTrajectories([
      ride({ id: 'assignee', driver_id: driverId, driver: { nom_affichage: 'Boyer Sophie' } }),
      ride({ id: 'libre' }),
    ]);
    const colorOf = (rideId: string): string | undefined =>
      markers.find((m) => m.id === `${rideId}:start`)?.color;
    expect(colorOf('assignee')).toBe(tourneeColor(driverId).hex);
    expect(colorOf('libre')).toBe(COURSE_MARKER_COLOR);
    // La non affectée le dit en toutes lettres (pas seulement « pas de couleur »).
    expect(markers.find((m) => m.id === 'libre:start')!.popupHtml).toContain('Non affectée');
  });
});
