import { describe, it, expect } from 'vitest';
import {
  aggregateDistanceDelaiKpis,
  ROAD_CORRECTION_FACTOR,
  type DistanceDelaiRideRow,
} from './distance-delai-kpis';
import { haversineKm } from '@/lib/optimizer/haversine';

function row(over: Partial<DistanceDelaiRideRow>): DistanceDelaiRideRow {
  return {
    driver_id: 'd1',
    status: 'terminee',
    no_show_at: null,
    scheduled_at: '2026-05-04T06:00:00.000Z',
    started_at: null,
    pickup_lat: -20.8823,
    pickup_lng: 55.4504,
    dropoff_lat: -20.9,
    dropoff_lng: 55.46,
    ...over,
  };
}

describe('aggregateDistanceDelaiKpis', () => {
  it('renvoie des zéros pour une entrée vide (aucune donnée inventée)', () => {
    const k = aggregateDistanceDelaiKpis([]);
    expect(k.ridesRealisees).toBe(0);
    expect(k.ridesAvecDistance).toBe(0);
    expect(k.kmMoyenParCourse).toBe(0);
    expect(k.ratioAVidePct).toBe(0);
    expect(k.ridesAvecDelai).toBe(0);
    expect(k.delaiMoyenMin).toBe(0);
  });

  it('estime le km en charge par Haversine × facteur de correction', () => {
    const k = aggregateDistanceDelaiKpis([row({})]);
    const attendu = haversineKm(-20.8823, 55.4504, -20.9, 55.46) * ROAD_CORRECTION_FACTOR;
    expect(k.ridesAvecDistance).toBe(1);
    expect(k.kmEnChargeTotal).toBeCloseTo(attendu, 6);
    expect(k.kmMoyenParCourse).toBeCloseTo(attendu, 6);
  });

  it('exclut les courses sans coordonnées complètes du km en charge', () => {
    const k = aggregateDistanceDelaiKpis([
      row({}),
      row({ pickup_lat: null, pickup_lng: null }),
      row({ dropoff_lat: null }),
    ]);
    expect(k.ridesRealisees).toBe(3);
    expect(k.ridesAvecDistance).toBe(1);
  });

  it('exclut les courses annulées et les no-shows (aucun trajet produit)', () => {
    const k = aggregateDistanceDelaiKpis([
      row({}),
      row({ status: 'annulee_patient' }),
      row({ no_show_at: '2026-05-04T06:10:00.000Z' }),
    ]);
    expect(k.ridesRealisees).toBe(1);
    expect(k.ridesAvecDistance).toBe(1);
  });

  it('calcule le km à vide entre courses consécutives du même chauffeur le même jour', () => {
    // Deux courses d1 le même jour → 1 trajet d'approche (dropoff1 → pickup2).
    const c1 = row({
      scheduled_at: '2026-05-04T06:00:00.000Z',
      dropoff_lat: -20.9,
      dropoff_lng: 55.46,
    });
    const c2 = row({
      scheduled_at: '2026-05-04T08:00:00.000Z',
      pickup_lat: -20.95,
      pickup_lng: 55.5,
    });
    const k = aggregateDistanceDelaiKpis([c1, c2]);
    const aVideAttendu = haversineKm(-20.9, 55.46, -20.95, 55.5) * ROAD_CORRECTION_FACTOR;
    expect(k.kmAVideTotal).toBeCloseTo(aVideAttendu, 6);
    expect(k.ratioAVidePct).toBe(Math.round((aVideAttendu / k.kmEnChargeTotal) * 100));
  });

  it('ne chaîne pas deux chauffeurs différents ni deux jours différents', () => {
    const k = aggregateDistanceDelaiKpis([
      row({ driver_id: 'd1', scheduled_at: '2026-05-04T06:00:00.000Z' }),
      row({ driver_id: 'd2', scheduled_at: '2026-05-04T08:00:00.000Z' }),
      row({ driver_id: 'd1', scheduled_at: '2026-05-05T06:00:00.000Z' }),
    ]);
    // Aucun couple consécutif (même chauffeur + même jour) → 0 km à vide.
    expect(k.kmAVideTotal).toBe(0);
  });

  it('calcule le délai moyen signé de prise en charge (retard positif)', () => {
    const k = aggregateDistanceDelaiKpis([
      // +10 min de retard
      row({ scheduled_at: '2026-05-04T06:00:00.000Z', started_at: '2026-05-04T06:10:00.000Z' }),
      // −4 min (départ en avance)
      row({ scheduled_at: '2026-05-04T07:00:00.000Z', started_at: '2026-05-04T06:56:00.000Z' }),
    ]);
    expect(k.ridesAvecDelai).toBe(2);
    expect(k.delaiMoyenMin).toBe(3); // moyenne (10 + (−4)) / 2 = 3
  });

  it('exclut du délai les courses non démarrées (started_at nul)', () => {
    const k = aggregateDistanceDelaiKpis([
      row({ started_at: null }),
      row({ scheduled_at: '2026-05-04T06:00:00.000Z', started_at: '2026-05-04T06:05:00.000Z' }),
    ]);
    expect(k.ridesAvecDelai).toBe(1);
    expect(k.delaiMoyenMin).toBe(5);
  });
});
