import { describe, it, expect } from 'vitest';
import {
  complianceStatus,
  complianceAlertStep,
  COMPLIANCE_SOON_DAYS,
  COMPLIANCE_ALERT_STEPS,
} from '../compliance-status';

const TODAY = new Date(2026, 5, 8); // 2026-06-08 (mois 0-indexé)

describe('complianceStatus — règles de seuil', () => {
  it('null/undefined → ok, daysUntilExpiry null', () => {
    expect(complianceStatus(null, TODAY)).toEqual({ status: 'ok', daysUntilExpiry: null });
    expect(complianceStatus(undefined, TODAY)).toEqual({ status: 'ok', daysUntilExpiry: null });
  });

  it('expires_at hier → expired (jours négatifs)', () => {
    expect(complianceStatus('2026-06-07', TODAY)).toEqual({
      status: 'expired',
      daysUntilExpiry: -1,
    });
  });

  it('expires_at aujourd’hui → soon (0 jours)', () => {
    expect(complianceStatus('2026-06-08', TODAY)).toEqual({
      status: 'soon',
      daysUntilExpiry: 0,
    });
  });

  it('expires_at dans 90 jours → soon (borne haute incluse)', () => {
    expect(complianceStatus('2026-09-06', TODAY)).toEqual({
      status: 'soon',
      daysUntilExpiry: COMPLIANCE_SOON_DAYS,
    });
  });

  it('expires_at dans 91 jours → ok', () => {
    expect(complianceStatus('2026-09-07', TODAY)).toEqual({
      status: 'ok',
      daysUntilExpiry: 91,
    });
  });

  it('expires_at dans 1 an → ok', () => {
    expect(complianceStatus('2027-06-08', TODAY)).toEqual({
      status: 'ok',
      daysUntilExpiry: 365,
    });
  });
});

describe('complianceAlertStep — franchissement palier', () => {
  it('null/undefined → null', () => {
    expect(complianceAlertStep(null, TODAY)).toBeNull();
  });

  it('palier 90 jours atteint (exactement)', () => {
    expect(complianceAlertStep('2026-09-06', TODAY)).toBe(90);
  });

  it('palier 60 jours atteint', () => {
    expect(complianceAlertStep('2026-08-07', TODAY)).toBe(60);
  });

  it('palier 30 jours atteint', () => {
    expect(complianceAlertStep('2026-07-08', TODAY)).toBe(30);
  });

  it('palier 7 jours atteint', () => {
    expect(complianceAlertStep('2026-06-15', TODAY)).toBe(7);
  });

  it('entre 2 paliers (45j) → null (pas de franchissement)', () => {
    expect(complianceAlertStep('2026-07-23', TODAY)).toBeNull();
  });

  it('expired → null (l’alerte expiration est gérée séparément)', () => {
    expect(complianceAlertStep('2026-06-07', TODAY)).toBeNull();
  });

  it('paliers configurés sont 90/60/30/7', () => {
    expect(Array.from(COMPLIANCE_ALERT_STEPS)).toEqual([90, 60, 30, 7]);
  });
});
