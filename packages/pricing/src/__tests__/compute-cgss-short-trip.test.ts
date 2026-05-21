import { describe, it, expect } from 'vitest';
import {
  computeCgssFromDistance,
  computeCgssShortTrip,
  type PricingInput,
  type TariffGrid,
} from '../compute-cgss-short-trip';

// Grille de test — image d'une ligne tariff_grids (DEC-057, valeurs 974).
const GRID: TariffGrid = {
  forfait_eur: 13.0,
  km_inclus: 4,
  prix_km_eur: 1.22,
  supplement_drom_eur: 3.0,
  supplement_tpmr_eur: 30.0,
  majoration_pct: 50,
  facteur_correction_routier: 1.4,
  arrondi_eur: 0.05,
};

const NO_HOLIDAYS = new Set<string>();

const PICKUP = { lat: -20.8823, lng: 55.4504 };
const DROPOFF_SHORT = { lat: -20.89, lng: 55.46 }; // ~1,3 km haversine
const DROPOFF_LONG = { lat: -20.95, lng: 55.55 }; // ~13 km haversine

function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
    dropoff_lat: DROPOFF_LONG.lat,
    dropoff_lng: DROPOFF_LONG.lng,
    // 2026-06-01 = lundi, 10h Réunion (06h UTC) → jour ouvré, pas de majo.
    scheduled_at: '2026-06-01T06:00:00.000Z',
    transport_mode: 'taxi_conventionne',
    holidays974: NO_HOLIDAYS,
    ...overrides,
  };
}

describe('computeCgssShortTrip', () => {
  it('1. trajet jour monopatient coords présentes → forfait + km + DROM', () => {
    const r = computeCgssShortTrip(baseInput(), GRID);
    expect(r.forfait_eur).toBe(13);
    expect(r.distance_method).toBe('haversine_corrige');
    expect(r.supplement_drom_eur).toBe(3);
    expect(r.supplement_tpmr_eur).toBe(0);
    expect(r.majoration_motif).toBeNull();
    expect(r.total_eur).toBeGreaterThan(13);
  });

  it('2. trajet > km_inclus → km_factures > 0', () => {
    const r = computeCgssShortTrip(baseInput(), GRID);
    expect(r.distance_km).not.toBeNull();
    expect(r.km_factures).not.toBeNull();
    expect(r.km_factures as number).toBeGreaterThan(0);
    expect(r.km_total_eur as number).toBeGreaterThan(0);
  });

  it('3. trajet ≤ km_inclus → km_factures = 0, forfait seul', () => {
    const r = computeCgssShortTrip(
      baseInput({
        dropoff_lat: DROPOFF_SHORT.lat,
        dropoff_lng: DROPOFF_SHORT.lng,
      }),
      GRID,
    );
    expect(r.km_factures).toBe(0);
    expect(r.km_total_eur).toBe(0);
    expect(r.total_eur).toBe(16); // 13 forfait + 3 DROM
  });

  it('4. TPMR → supplément 30 € ajouté', () => {
    const r = computeCgssShortTrip(baseInput({ transport_mode: 'tpmr' }), GRID);
    expect(r.supplement_tpmr_eur).toBe(30);
  });

  it('5. majoration nuit (départ 21h Réunion)', () => {
    // 21h Réunion = 17h UTC.
    const r = computeCgssShortTrip(baseInput({ scheduled_at: '2026-06-01T17:00:00.000Z' }), GRID);
    expect(r.majoration_motif).toBe('nuit');
    expect(r.majoration_pct).toBe(50);
    expect(r.majoration_eur).toBeGreaterThan(0);
  });

  it('6. majoration weekend (samedi 14h Réunion)', () => {
    // 2026-06-06 = samedi ; 14h Réunion = 10h UTC.
    const r = computeCgssShortTrip(baseInput({ scheduled_at: '2026-06-06T10:00:00.000Z' }), GRID);
    expect(r.majoration_motif).toBe('weekend');
  });

  it('7. majoration weekend (dimanche 10h Réunion)', () => {
    // 2026-06-07 = dimanche ; 10h Réunion = 06h UTC.
    const r = computeCgssShortTrip(baseInput({ scheduled_at: '2026-06-07T06:00:00.000Z' }), GRID);
    expect(r.majoration_motif).toBe('weekend');
  });

  it('8. majoration férié (date ∈ holidays974)', () => {
    const r = computeCgssShortTrip(
      baseInput({
        scheduled_at: '2026-07-14T06:00:00.000Z',
        holidays974: new Set(['2026-07-14']),
      }),
      GRID,
    );
    expect(r.majoration_motif).toBe('ferie');
  });

  it('9. priorité férié > nuit (jour férié à 22h)', () => {
    // 2026-07-14 22h Réunion = 18h UTC ; férié l'emporte sur nuit.
    const r = computeCgssShortTrip(
      baseInput({
        scheduled_at: '2026-07-14T18:00:00.000Z',
        holidays974: new Set(['2026-07-14']),
      }),
      GRID,
    );
    expect(r.majoration_motif).toBe('ferie');
  });

  it('10. coords manquantes → distance unavailable, forfait + DROM + TPMR', () => {
    const r = computeCgssShortTrip(
      baseInput({
        pickup_lat: null,
        dropoff_lat: null,
        transport_mode: 'tpmr',
      }),
      GRID,
    );
    expect(r.distance_method).toBe('unavailable');
    expect(r.distance_km).toBeNull();
    expect(r.km_factures).toBeNull();
    expect(r.km_total_eur).toBeNull();
    expect(r.prix_km_eur).toBeNull();
    expect(r.total_eur).toBe(46); // 13 + 3 DROM + 30 TPMR
  });

  it('11. samedi avant 12h → pas de majoration weekend', () => {
    // 2026-06-06 samedi ; 09h Réunion = 05h UTC.
    const r = computeCgssShortTrip(baseInput({ scheduled_at: '2026-06-06T05:00:00.000Z' }), GRID);
    expect(r.majoration_motif).toBeNull();
  });

  it('12. timezone : 23h UTC = 03h Réunion lendemain → nuit', () => {
    // 2026-06-01 23h UTC = 2026-06-02 03h Réunion → nuit (03h < 8h).
    const r = computeCgssShortTrip(baseInput({ scheduled_at: '2026-06-01T23:00:00.000Z' }), GRID);
    expect(r.majoration_motif).toBe('nuit');
  });
});

describe('computeCgssFromDistance (cœur partagé — simulateur admin)', () => {
  const params = {
    scheduled_at: '2026-06-01T06:00:00.000Z',
    transport_mode: 'taxi_conventionne' as const,
    holidays974: NO_HOLIDAYS,
  };

  it('distance directe > km_inclus → km facturés au prorata', () => {
    const r = computeCgssFromDistance(10, params, GRID);
    expect(r.distance_method).toBe('haversine_corrige');
    expect(r.km_factures).toBe(6); // 10 - 4 km inclus
    expect(r.km_total_eur as number).toBeCloseTo(7.3, 2); // 6 × 1,22 → arrondi 0,05
  });

  it('distance directe ≤ km_inclus → forfait seul', () => {
    const r = computeCgssFromDistance(3, params, GRID);
    expect(r.km_factures).toBe(0);
    expect(r.km_total_eur).toBe(0);
    expect(r.total_eur).toBe(16); // 13 forfait + 3 DROM
  });

  it('distance null → distance_method unavailable', () => {
    const r = computeCgssFromDistance(null, params, GRID);
    expect(r.distance_method).toBe('unavailable');
    expect(r.distance_km).toBeNull();
    expect(r.km_factures).toBeNull();
  });
});
