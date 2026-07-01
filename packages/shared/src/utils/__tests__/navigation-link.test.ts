import { describe, it, expect } from 'vitest';
import { buildNavigationUrl } from '../navigation-link';

describe('buildNavigationUrl', () => {
  it('privilégie les coordonnées quand elles sont présentes', () => {
    expect(buildNavigationUrl({ lat: -20.8823, lng: 55.4504, address: 'ignorée' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-20.8823,55.4504',
    );
  });

  it('se replie sur l’adresse encodée si pas de coordonnées', () => {
    expect(buildNavigationUrl({ address: '12 rue de Paris, 97400 Saint-Denis' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12%20rue%20de%20Paris%2C%2097400%20Saint-Denis',
    );
  });

  it('ignore des coordonnées partielles ou non finies et retombe sur l’adresse', () => {
    expect(buildNavigationUrl({ lat: -20.88, lng: null, address: 'Le Tampon' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Le%20Tampon',
    );
    expect(buildNavigationUrl({ lat: NaN, lng: 55.4, address: 'Le Tampon' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Le%20Tampon',
    );
  });

  it('retourne null si ni coordonnées ni adresse exploitables', () => {
    expect(buildNavigationUrl({})).toBeNull();
    expect(buildNavigationUrl({ address: '   ' })).toBeNull();
    expect(buildNavigationUrl({ lat: null, lng: null, address: null })).toBeNull();
  });
});
