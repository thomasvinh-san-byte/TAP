import { describe, it, expect } from 'vitest';
import {
  selectComplianceAlerts,
  countComplianceAlerts,
  type ComplianceAlertSource,
} from '../compliance-alerts';

const TODAY = new Date(2026, 5, 8); // 2026-06-08

function src(
  id: string,
  expires_at: string | null,
  overrides: Partial<ComplianceAlertSource> = {},
): ComplianceAlertSource {
  return {
    id,
    entity_type: 'driver',
    entity_id: 'drv',
    kind: 'carte_pro',
    expires_at,
    ...overrides,
  };
}

describe('selectComplianceAlerts — filtre dérivé', () => {
  it('ignore les items sans expires_at', () => {
    expect(selectComplianceAlerts([src('a', null)], TODAY)).toEqual([]);
  });

  it('ignore les items > 90 jours (status ok)', () => {
    expect(selectComplianceAlerts([src('a', '2027-06-08')], TODAY)).toEqual([]);
  });

  it('garde un item à 90 jours (borne haute soon)', () => {
    const out = selectComplianceAlerts([src('a', '2026-09-06')], TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', status: 'soon', daysUntilExpiry: 90 });
  });

  it('garde un item expiré (jours négatifs)', () => {
    const out = selectComplianceAlerts([src('a', '2026-06-01')], TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', status: 'expired', daysUntilExpiry: -7 });
  });
});

describe('selectComplianceAlerts — tri par urgence', () => {
  it('expired d’abord, du plus passé au moins passé', () => {
    const out = selectComplianceAlerts(
      [src('a', '2026-06-07'), src('b', '2026-06-01'), src('c', '2026-05-08')],
      TODAY,
    );
    expect(out.map((a) => a.id)).toEqual(['c', 'b', 'a']);
  });

  it('soon trié par jours croissants (le plus proche en haut)', () => {
    const out = selectComplianceAlerts(
      [src('a', '2026-07-08'), src('b', '2026-06-15'), src('c', '2026-09-01')],
      TODAY,
    );
    expect(out.map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });

  it('expired toujours avant soon', () => {
    const out = selectComplianceAlerts(
      [
        src('proche', '2026-06-15'),
        src('expire-vieux', '2026-05-08'),
        src('expire-recent', '2026-06-07'),
      ],
      TODAY,
    );
    expect(out.map((a) => a.id)).toEqual(['expire-vieux', 'expire-recent', 'proche']);
  });
});

describe('countComplianceAlerts', () => {
  it('compte expired et soon séparément', () => {
    const alerts = selectComplianceAlerts(
      [
        src('a', '2026-06-01'), // expired
        src('b', '2026-06-15'), // soon
        src('c', '2026-09-01'), // soon
      ],
      TODAY,
    );
    expect(countComplianceAlerts(alerts)).toEqual({ expired: 1, soon: 2, total: 3 });
  });

  it('retourne tout à zéro pour liste vide', () => {
    expect(countComplianceAlerts([])).toEqual({ expired: 0, soon: 0, total: 0 });
  });
});
