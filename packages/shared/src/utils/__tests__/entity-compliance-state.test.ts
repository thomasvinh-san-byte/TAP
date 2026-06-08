import { describe, it, expect } from 'vitest';
import { entityComplianceState, isPlanningBlocking } from '../entity-compliance-state';

const TODAY = new Date(2026, 5, 8); // 2026-06-08

describe('entityComplianceState — agrégation niveau entité', () => {
  it('liste vide → ok / pas de bloquant', () => {
    const s = entityComplianceState([], TODAY);
    expect(s).toEqual({ hasExpired: false, hasSoon: false, worstStatus: 'ok' });
    expect(isPlanningBlocking(s)).toBe(false);
  });

  it('toutes les échéances sans expires_at → ok', () => {
    const s = entityComplianceState([{ expires_at: null }, { expires_at: null }], TODAY);
    expect(s.worstStatus).toBe('ok');
    expect(isPlanningBlocking(s)).toBe(false);
  });

  it('une seule échéance lointaine → ok', () => {
    const s = entityComplianceState([{ expires_at: '2028-01-01' }], TODAY);
    expect(s).toEqual({ hasExpired: false, hasSoon: false, worstStatus: 'ok' });
  });

  it('une échéance soon → worst=soon, pas bloquant', () => {
    const s = entityComplianceState([{ expires_at: '2026-07-15' }], TODAY);
    expect(s).toEqual({ hasExpired: false, hasSoon: true, worstStatus: 'soon' });
    expect(isPlanningBlocking(s)).toBe(false);
  });

  it('une échéance expirée → worst=expired, BLOQUANT', () => {
    const s = entityComplianceState([{ expires_at: '2026-05-01' }], TODAY);
    expect(s).toEqual({ hasExpired: true, hasSoon: false, worstStatus: 'expired' });
    expect(isPlanningBlocking(s)).toBe(true);
  });

  it('mélange expirée + soon + lointaine → expired prévaut', () => {
    const s = entityComplianceState(
      [
        { expires_at: '2026-05-01' }, // expired
        { expires_at: '2026-07-15' }, // soon
        { expires_at: '2028-01-01' }, // ok
        { expires_at: null }, // ignoré
      ],
      TODAY,
    );
    expect(s).toEqual({ hasExpired: true, hasSoon: true, worstStatus: 'expired' });
    expect(isPlanningBlocking(s)).toBe(true);
  });

  it('plusieurs soon → reste soon (pas bloquant)', () => {
    const s = entityComplianceState(
      [{ expires_at: '2026-07-15' }, { expires_at: '2026-08-30' }],
      TODAY,
    );
    expect(s.worstStatus).toBe('soon');
    expect(isPlanningBlocking(s)).toBe(false);
  });

  it('today fourni en string ISO accepté', () => {
    const s = entityComplianceState([{ expires_at: '2026-07-15' }], '2026-06-08');
    expect(s.worstStatus).toBe('soon');
  });
});
