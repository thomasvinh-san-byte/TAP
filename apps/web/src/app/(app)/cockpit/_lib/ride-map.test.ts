import { describe, it, expect } from 'vitest';
import { buildRideTrajectories, rideIsGeocoded, COURSE_MARKER_COLOR } from './ride-map';
import { getGroupColor } from '../optimisation/_lib/group-colors';
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

    // Hiérarchie visuelle : la couleur vive « par course » est portée par la LIGNE
    // seulement ; les marqueurs départ/arrivée restent NEUTRES (en appui), pour ne
    // pas rivaliser avec la couleur d'identité chauffeur.
    const color0 = getGroupColor(0).hex;
    expect(lines[0]!.color).toBe(color0);
    expect(start!.color).toBe(COURSE_MARKER_COLOR);
    expect(end!.color).toBe(COURSE_MARKER_COLOR);
    expect(start!.color).not.toBe(color0);
    expect(lines[0]!.from).toEqual({ lat: -21.3388, lng: 55.4802 });
    expect(lines[0]!.to).toEqual({ lat: -21.2788, lng: 55.5158 });
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

  it('attribue une couleur distincte par course (rang) via la palette', () => {
    const { lines } = buildRideTrajectories([
      ride({ id: 'a' }),
      ride({ id: 'b' }),
      ride({ id: 'c' }),
    ]);
    expect(lines.map((l) => l.color)).toEqual([
      getGroupColor(0).hex,
      getGroupColor(1).hex,
      getGroupColor(2).hex,
    ]);
  });
});
