import { describe, it, expect } from 'vitest';
import { buildCoursePointPopupData, renderCoursePointPopupHtml } from './course-popup';

describe('buildCoursePointPopupData — identifier un point de course', () => {
  it('un départ porte le mot « Départ », le patient et l’adresse de prise en charge', () => {
    const data = buildCoursePointPopupData({
      kind: 'start',
      patient: 'Hoarau Patrick',
      address: '12 Rue des Bons-Enfants, 97410 Saint-Pierre',
      scheduledLabel: '06:30',
    });
    expect(data.kindLabel).toBe('Départ');
    expect(data.patient).toBe('Hoarau Patrick');
    expect(data.address).toContain('Saint-Pierre');
    expect(data.scheduledLabel).toBe('06:30');
  });

  it('une arrivée porte le mot « Arrivée » et le lieu / l’adresse de destination', () => {
    const data = buildCoursePointPopupData({
      kind: 'end',
      patient: 'Hoarau Patrick',
      address: 'Dialyse Sud, Le Tampon',
    });
    expect(data.kindLabel).toBe('Arrivée');
    expect(data.address).toBe('Dialyse Sud, Le Tampon');
    // Heure absente → nulle, pas de valeur inventée.
    expect(data.scheduledLabel).toBeNull();
  });
});

describe('renderCoursePointPopupHtml', () => {
  it('affiche le mot, le patient et l’adresse ; échappe le HTML', () => {
    const html = renderCoursePointPopupHtml(
      buildCoursePointPopupData({
        kind: 'start',
        patient: '<b>Payet</b>',
        address: 'CHU Félix Guyon',
        scheduledLabel: '09:15',
      }),
    );
    expect(html).toContain('Départ');
    expect(html).toContain('CHU Félix Guyon');
    expect(html).toContain('Prévue · 09:15');
    // Le nom potentiellement dangereux est échappé.
    expect(html).not.toContain('<b>Payet</b>');
    expect(html).toContain('&lt;b&gt;Payet&lt;/b&gt;');
  });

  it('omet l’heure quand elle est absente', () => {
    const html = renderCoursePointPopupHtml(
      buildCoursePointPopupData({ kind: 'end', patient: 'Grondin Marie', address: null }),
    );
    expect(html).toContain('Arrivée');
    expect(html).toContain('Grondin Marie');
    expect(html).not.toContain('Prévue');
  });
});
