import { describe, it, expect } from 'vitest';
import { proposeReassignments, type ReassignCandidate, type RideToReassign } from './reassign';

// Saint-Denis ~ (-20.88, 55.45) ; Saint-Pierre ~ (-21.34, 55.48) ; ~50 km.
const RIDE_STDENIS: RideToReassign = {
  id: 'ride-1',
  transport_mode: 'taxi_conventionne',
  pickup_lat: -20.88,
  pickup_lng: 55.45,
  scheduled_at: '2026-06-15T08:00:00.000Z',
};

function candidate(over: Partial<ReassignCandidate>): ReassignCandidate {
  return {
    driverId: 'd',
    driverLabel: 'Chauffeur',
    typePermis: ['taxi'],
    load: 0,
    refPoints: [],
    ...over,
  };
}

describe('proposeReassignments — compatibilité permis', () => {
  it('exclut un chauffeur sans le permis requis (taxi)', () => {
    const [proposal] = proposeReassignments(
      [RIDE_STDENIS],
      [candidate({ driverId: 'a', typePermis: ['b'] })],
    );
    expect(proposal!.reassignable).toBe(false);
    expect(proposal!.best).toBeNull();
  });

  it('une course TPMR n’est proposée qu’à un chauffeur permis tpmr', () => {
    const ride: RideToReassign = { ...RIDE_STDENIS, transport_mode: 'tpmr' };
    const [proposal] = proposeReassignments(
      [ride],
      [
        candidate({ driverId: 'taxi', typePermis: ['taxi'] }),
        candidate({ driverId: 'tpmr', typePermis: ['tpmr'] }),
      ],
    );
    expect(proposal!.candidates).toHaveLength(1);
    expect(proposal!.best!.driverId).toBe('tpmr');
  });
});

describe('proposeReassignments — score proximité + charge', () => {
  it('préfère le chauffeur le plus proche (référence temporelle)', () => {
    const near = candidate({
      driverId: 'near',
      refPoints: [{ scheduled_at: '2026-06-15T08:30:00.000Z', lat: -20.89, lng: 55.46 }],
    });
    const far = candidate({
      driverId: 'far',
      refPoints: [{ scheduled_at: '2026-06-15T08:30:00.000Z', lat: -21.34, lng: 55.48 }],
    });
    const [proposal] = proposeReassignments([RIDE_STDENIS], [near, far]);
    expect(proposal!.best!.driverId).toBe('near');
    expect(proposal!.best!.distanceKm).toBeLessThan(5);
  });

  it('pénalise la surcharge : à proximité égale, le moins chargé gagne', () => {
    const ref = { scheduled_at: '2026-06-15T08:30:00.000Z', lat: -20.88, lng: 55.45 };
    const light = candidate({ driverId: 'light', load: 0, refPoints: [ref] });
    const heavy = candidate({ driverId: 'heavy', load: 4, refPoints: [ref] });
    const [proposal] = proposeReassignments([RIDE_STDENIS], [light, heavy]);
    expect(proposal!.best!.driverId).toBe('light');
  });

  it('une course sans coordonnées reste réaffectable (score par charge)', () => {
    const ride: RideToReassign = { ...RIDE_STDENIS, pickup_lat: null, pickup_lng: null };
    const [proposal] = proposeReassignments(
      [ride],
      [candidate({ driverId: 'a', load: 2 }), candidate({ driverId: 'b', load: 0 })],
    );
    expect(proposal!.reassignable).toBe(true);
    expect(proposal!.best!.driverId).toBe('b');
    expect(proposal!.best!.distanceKm).toBeNull();
  });
});
