/**
 * Tests Vitest — computeCgssShortTrip (DEC-042).
 *
 * Vise 100 % branch coverage : Haversine vs fallback, majo nuit, supp TPMR,
 * clamps min/max, urgence immediate, scénarios edge.
 *
 * Refs : DEC-042 LOCKED, DEC-013 esprit (calcul critique data financière).
 */

import { describe, expect, it } from 'vitest';
import { computeCgssShortTrip, type PricingInput } from '../compute-cgss-short-trip';

// Coords approximatives Réunion pour fixtures réalistes
const SAINT_DENIS = { lat: -20.8789, lng: 55.4481 };
const CHU_BELLEPIERRE = { lat: -20.8845, lng: 55.453 }; // ~1 km
const SAINT_PIERRE = { lat: -21.3393, lng: 55.4781 }; // ~80 km plat

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    scheduled_at: '2026-05-15T14:00:00Z', // 14h UTC → pas de majo nuit
    transport_mode: 'taxi_conventionne',
    urgency: 'programmee',
    ...overrides,
  };
}

describe('computeCgssShortTrip — Haversine', () => {
  it('Saint-Denis → CHU Bellepierre (~1 km) — Haversine + clamp min 10€', () => {
    const r = computeCgssShortTrip(
      makeInput({
        pickup_lat: SAINT_DENIS.lat,
        pickup_lng: SAINT_DENIS.lng,
        dropoff_lat: CHU_BELLEPIERRE.lat,
        dropoff_lng: CHU_BELLEPIERRE.lng,
      }),
    );
    expect(r.source).toBe('haversine');
    expect(r.distance_km).toBeGreaterThan(0);
    expect(r.distance_km).toBeLessThan(2);
    expect(r.forfait_eur).toBe(4.2);
    expect(r.prix_km_eur).toBe(2.1);
    expect(r.total_eur).toBe(10); // forfait + 1km*2.10 ≈ 6.30 → clamp 10
    expect(r.majo_nuit_pct).toBe(0);
    expect(r.supp_tpmr_eur).toBe(0);
  });

  it('Saint-Denis → Saint-Pierre (~80 km) — clamp max 80€', () => {
    const r = computeCgssShortTrip(
      makeInput({
        pickup_lat: SAINT_DENIS.lat,
        pickup_lng: SAINT_DENIS.lng,
        dropoff_lat: SAINT_PIERRE.lat,
        dropoff_lng: SAINT_PIERRE.lng,
      }),
    );
    expect(r.source).toBe('haversine');
    expect(r.distance_km).toBeGreaterThan(40);
    expect(r.total_eur).toBe(80); // forfait + 80*2.10 ≈ 172 → clamp 80
  });

  it('distance trajet moyen ~10 km → tarif ~25€', () => {
    // Construire deux points à ~10 km en latitude (1° lat = 111 km)
    const r = computeCgssShortTrip(
      makeInput({
        pickup_lat: -20.8789,
        pickup_lng: 55.4481,
        dropoff_lat: -20.7889, // ~10 km au nord
        dropoff_lng: 55.4481,
      }),
    );
    expect(r.source).toBe('haversine');
    expect(r.total_eur).toBeGreaterThanOrEqual(20);
    expect(r.total_eur).toBeLessThanOrEqual(35);
  });
});

describe('computeCgssShortTrip — fallback random', () => {
  it('pas de coords → fallback_random + total dans la plage clamp', () => {
    const r = computeCgssShortTrip(makeInput());
    expect(r.source).toBe('fallback_random');
    expect(r.distance_km).toBeNull();
    expect(r.prix_km_eur).toBeNull();
    expect(r.km_total_eur).toBeNull();
    expect(r.total_eur).toBeGreaterThanOrEqual(10);
    expect(r.total_eur).toBeLessThanOrEqual(80);
  });

  it('fallback déterministe — même scheduled_at → même total', () => {
    const a = computeCgssShortTrip(makeInput());
    const b = computeCgssShortTrip(makeInput());
    expect(a.total_eur).toBe(b.total_eur);
  });

  it('fallback urgence immediate → plage plus haute que programmee', () => {
    const programmee = computeCgssShortTrip(makeInput({ urgency: 'programmee' }));
    const immediate = computeCgssShortTrip(makeInput({ urgency: 'immediate' }));
    expect(immediate.total_eur).toBeGreaterThanOrEqual(programmee.total_eur);
  });

  it('coords partielles (pickup only) → fallback', () => {
    const r = computeCgssShortTrip(
      makeInput({
        pickup_lat: SAINT_DENIS.lat,
        pickup_lng: SAINT_DENIS.lng,
        // dropoff absent
      }),
    );
    expect(r.source).toBe('fallback_random');
  });

  it('coords null explicites → fallback', () => {
    const r = computeCgssShortTrip(
      makeInput({
        pickup_lat: null,
        pickup_lng: null,
        dropoff_lat: null,
        dropoff_lng: null,
      }),
    );
    expect(r.source).toBe('fallback_random');
  });
});

describe('computeCgssShortTrip — majoration nuit', () => {
  it('22h UTC → majo nuit +20%', () => {
    const r = computeCgssShortTrip(
      makeInput({ scheduled_at: '2026-05-15T22:00:00Z' }),
    );
    expect(r.majo_nuit_pct).toBe(20);
    expect(r.majo_nuit_eur).toBeGreaterThan(0);
  });

  it('14h UTC → pas de majo nuit', () => {
    const r = computeCgssShortTrip(
      makeInput({ scheduled_at: '2026-05-15T14:00:00Z' }),
    );
    expect(r.majo_nuit_pct).toBe(0);
    expect(r.majo_nuit_eur).toBe(0);
  });

  it('6h UTC → majo nuit (h < 7)', () => {
    const r = computeCgssShortTrip(
      makeInput({ scheduled_at: '2026-05-15T06:00:00Z' }),
    );
    expect(r.majo_nuit_pct).toBe(20);
  });

  it('20h UTC pile → majo nuit (h >= 20)', () => {
    const r = computeCgssShortTrip(
      makeInput({ scheduled_at: '2026-05-15T20:00:00Z' }),
    );
    expect(r.majo_nuit_pct).toBe(20);
  });
});

describe('computeCgssShortTrip — supplément TPMR', () => {
  it('transport_mode tpmr → supp 5€', () => {
    const r = computeCgssShortTrip(
      makeInput({ transport_mode: 'tpmr' }),
    );
    expect(r.supp_tpmr_eur).toBe(5);
  });

  it('transport_mode taxi_conventionne → pas de supp', () => {
    const r = computeCgssShortTrip(
      makeInput({ transport_mode: 'taxi_conventionne' }),
    );
    expect(r.supp_tpmr_eur).toBe(0);
  });

  it('transport_mode vsl → pas de supp', () => {
    const r = computeCgssShortTrip(makeInput({ transport_mode: 'vsl' }));
    expect(r.supp_tpmr_eur).toBe(0);
  });
});

describe('computeCgssShortTrip — combinaisons', () => {
  it('Haversine + TPMR + nuit + clamp', () => {
    const r = computeCgssShortTrip(
      makeInput({
        pickup_lat: SAINT_DENIS.lat,
        pickup_lng: SAINT_DENIS.lng,
        dropoff_lat: CHU_BELLEPIERRE.lat,
        dropoff_lng: CHU_BELLEPIERRE.lng,
        transport_mode: 'tpmr',
        scheduled_at: '2026-05-15T22:00:00Z',
      }),
    );
    expect(r.source).toBe('haversine');
    expect(r.supp_tpmr_eur).toBe(5);
    expect(r.majo_nuit_pct).toBe(20);
    expect(r.total_eur).toBeGreaterThanOrEqual(10);
  });
});
