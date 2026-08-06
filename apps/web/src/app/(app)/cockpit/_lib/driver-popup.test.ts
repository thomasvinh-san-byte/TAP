import { describe, it, expect } from 'vitest';
import {
  buildDriverPopupData,
  driverFreshness,
  renderDriverPopupHtml,
  POSITION_EXPIRED_MIN,
} from './driver-popup';
import { POSITION_STALE_MIN } from './use-driver-positions';

describe('driverFreshness — repère de fraîcheur selon l’ancienneté', () => {
  it('récente sous le seuil géoloc, ancienne au-delà, périmée au seuil périmé', () => {
    expect(driverFreshness(POSITION_STALE_MIN - 0.1).level).toBe('recente');
    expect(driverFreshness(POSITION_STALE_MIN).level).toBe('ancienne');
    expect(driverFreshness(POSITION_EXPIRED_MIN - 0.1).level).toBe('ancienne');
    expect(driverFreshness(POSITION_EXPIRED_MIN).level).toBe('perimee');
  });

  it('porte un mot (pas la couleur seule) et un ton sémantique', () => {
    expect(driverFreshness(1)).toMatchObject({ label: 'Position récente', tone: 'success' });
    expect(driverFreshness(10)).toMatchObject({ label: 'Position ancienne', tone: 'warning' });
    expect(driverFreshness(60)).toMatchObject({ label: 'Position périmée', tone: 'danger' });
  });
});

describe('buildDriverPopupData', () => {
  const now = new Date('2026-05-22T10:00:00Z');

  it('dérive nom, charge, ancienneté et fraîcheur depuis une position', () => {
    const data = buildDriverPopupData({
      name: 'Vergoz Jean',
      capturedAt: '2026-05-22T09:52:00Z', // 8 min avant `now`
      now,
      loadCount: 3,
      currentRide: { scheduledLabel: '09:30', dropoff: 'CHU Félix Guyon' },
    });
    expect(data.name).toBe('Vergoz Jean');
    expect(Math.round(data.ageMinutes)).toBe(8);
    expect(data.freshness.level).toBe('ancienne'); // 8 min → ancienne
    expect(data.ageLabel).toContain('8');
    expect(data.loadCount).toBe(3);
    expect(data.currentRide).toEqual({ scheduledLabel: '09:30', dropoff: 'CHU Félix Guyon' });
  });

  it('position fraîche (< seuil) → récente ; sans course en cours', () => {
    const data = buildDriverPopupData({
      name: 'Boyer Sophie',
      capturedAt: '2026-05-22T09:58:00Z', // 2 min
      now,
      loadCount: 0,
      currentRide: null,
    });
    expect(data.freshness.level).toBe('recente');
    expect(data.currentRide).toBeNull();
  });
});

describe('renderDriverPopupHtml', () => {
  it('affiche le nom, le mot de statut, l’ancienneté et la charge ; échappe le HTML', () => {
    const html = renderDriverPopupHtml(
      buildDriverPopupData({
        name: '<b>Payet</b>',
        capturedAt: '2026-05-22T09:40:00Z',
        now: new Date('2026-05-22T10:00:00Z'),
        loadCount: 2,
        currentRide: null,
      }),
    );
    expect(html).toContain('Position ancienne'); // mot présent (pas couleur seule)
    expect(html).toContain('2 courses affectées');
    expect(html).toContain('Dernière position connue');
    // Le nom potentiellement dangereux est échappé.
    expect(html).not.toContain('<b>Payet</b>');
    expect(html).toContain('&lt;b&gt;Payet&lt;/b&gt;');
  });
});
