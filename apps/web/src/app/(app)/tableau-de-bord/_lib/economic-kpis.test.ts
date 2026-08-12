import { describe, it, expect } from 'vitest';
import {
  aggregateEconomicKpis,
  ROAD_CORRECTION_FACTOR,
  type EconomicRideRow,
} from './economic-kpis';
import { haversineKm } from '@/lib/optimizer/haversine';

function row(over: Partial<EconomicRideRow>): EconomicRideRow {
  return {
    tarif_amount_eur: 20,
    ride_group_id: null,
    pickup_lat: -20.8823,
    pickup_lng: 55.4504,
    dropoff_lat: -20.9,
    dropoff_lng: 55.46,
    ...over,
  };
}

const KM = haversineKm(-20.8823, 55.4504, -20.9, 55.46) * ROAD_CORRECTION_FACTOR;

describe('aggregateEconomicKpis', () => {
  it('renvoie « non configuré » quand aucun coût/km (jamais un zéro trompeur)', () => {
    const k = aggregateEconomicKpis([row({})], null);
    expect(k.configured).toBe(false);
    expect(k.margeBrute).toBe(0);
    expect(k.coutParKm).toBe(0);
  });

  it('calcule marge brute = CA − coût estimé (coût/km × km estimés)', () => {
    const k = aggregateEconomicKpis([row({ tarif_amount_eur: 20 })], 0.5);
    expect(k.configured).toBe(true);
    expect(k.ridesEstimables).toBe(1);
    expect(k.kmEnChargeTotal).toBeCloseTo(KM, 6);
    expect(k.caRealiseTotal).toBe(20);
    expect(k.coutEstimeTotal).toBeCloseTo(0.5 * KM, 6);
    expect(k.margeBrute).toBeCloseTo(20 - 0.5 * KM, 6);
  });

  it('exclut les courses sans coordonnées (couverture honnête)', () => {
    const k = aggregateEconomicKpis(
      [row({}), row({ pickup_lat: null }), row({ dropoff_lng: null })],
      0.5,
    );
    expect(k.ridesEstimables).toBe(1);
  });

  it('sépare la rentabilité mutualisé (groupe ≥ 2) vs non mutualisé', () => {
    const k = aggregateEconomicKpis(
      [
        row({ ride_group_id: 'g1', tarif_amount_eur: 20 }),
        row({ ride_group_id: 'g1', tarif_amount_eur: 20 }),
        row({ ride_group_id: null, tarif_amount_eur: 30 }),
      ],
      0.5,
    );
    // 2 mutualisées (g1, taille 2) + 1 non mutualisée.
    expect(k.margeMutualisees).toBeCloseTo(40 - 0.5 * (2 * KM), 6);
    expect(k.margeNonMutualisees).toBeCloseTo(30 - 0.5 * KM, 6);
    // Cohérence : somme des deux = marge brute totale.
    expect(k.margeMutualisees + k.margeNonMutualisees).toBeCloseTo(k.margeBrute, 6);
  });

  it('un groupe d’une seule course n’est pas une mutualisation', () => {
    const k = aggregateEconomicKpis([row({ ride_group_id: 'solo', tarif_amount_eur: 10 })], 0.5);
    expect(k.margeMutualisees).toBe(0);
    expect(k.margeNonMutualisees).toBeCloseTo(10 - 0.5 * KM, 6);
  });
});
