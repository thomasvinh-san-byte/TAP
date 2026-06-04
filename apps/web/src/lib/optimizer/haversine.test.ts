import { describe, it, expect } from 'vitest';
import { distanceMatrix, haversineKm } from './haversine';

describe('haversineKm', () => {
  it('renvoie une distance positive entre Saint-Denis et Saint-Pierre', () => {
    const dist = haversineKm(-20.8825, 55.4513, -21.3393, 55.4781);
    expect(dist).toBeGreaterThan(40);
    expect(dist).toBeLessThan(80);
  });
});

describe('distanceMatrix', () => {
  const coords: Array<[number, number]> = [
    [-20.8825, 55.4513],
    [-21.3393, 55.4781],
    [-21.1, 55.6],
  ];

  it('produit une matrice 3x3 avec diagonale nulle', () => {
    const dm = distanceMatrix(coords, 1.3);
    expect(dm.length).toBe(3);
    expect(dm[0]!.length).toBe(3);
    for (let i = 0; i < 3; i += 1) {
      expect(dm[i]![i]!).toBeCloseTo(0, 9);
    }
  });

  it('est symétrique', () => {
    const dm = distanceMatrix(coords, 1.3);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        expect(dm[i]![j]!).toBeCloseTo(dm[j]![i]!, 6);
      }
    }
  });

  it('applique le facteur de correction', () => {
    const dm = distanceMatrix(coords, 1.3);
    const raw = haversineKm(coords[0]![0], coords[0]![1], coords[1]![0], coords[1]![1]);
    expect(dm[0]![1]!).toBeCloseTo(raw * 1.3, 6);
  });
});
