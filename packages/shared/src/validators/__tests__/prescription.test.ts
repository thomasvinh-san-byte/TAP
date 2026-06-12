import { describe, it, expect } from 'vitest';
import { derivePrescriptionAlerts, type PrescriptionAlertSource } from '../prescription';

const TODAY = new Date('2026-06-15T08:00:00.000Z');

function presc(over: Partial<PrescriptionAlertSource>): PrescriptionAlertSource {
  return {
    id: 'p1',
    patient_id: 'pat1',
    numero: 'BT-001',
    trajets_autorises: 5,
    trajets_consommes: 0,
    date_expiration: null,
    ...over,
  };
}

describe('derivePrescriptionAlerts', () => {
  it("n'alerte pas une prescription peu consommée (2/5, non récurrente)", () => {
    const alerts = derivePrescriptionAlerts([presc({ trajets_consommes: 2 })], TODAY);
    expect(alerts).toHaveLength(0);
  });

  it('alerte au seuil 80 % (4/5)', () => {
    const alerts = derivePrescriptionAlerts([presc({ trajets_consommes: 4 })], TODAY);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.kind).toBe('seuil_80');
    expect(alerts[0]!.trajets_restants).toBe(1);
  });

  it('alerte épuisée (5/5)', () => {
    const alerts = derivePrescriptionAlerts([presc({ trajets_consommes: 5 })], TODAY);
    expect(alerts[0]!.kind).toBe('epuisee');
    expect(alerts[0]!.trajets_restants).toBe(0);
  });

  it('alerte expirée (date passée) prioritaire sur le compteur', () => {
    const alerts = derivePrescriptionAlerts(
      [presc({ trajets_consommes: 5, date_expiration: '2026-06-01' })],
      TODAY,
    );
    expect(alerts[0]!.kind).toBe('expiree');
  });

  it('renouvellement pour patient récurrent proche du seuil', () => {
    const alerts = derivePrescriptionAlerts([presc({ trajets_consommes: 4 })], TODAY, {
      recurringPatientIds: new Set(['pat1']),
    });
    expect(alerts[0]!.kind).toBe('renouvellement');
  });

  it('renouvellement si expiration dans moins de 15 jours (patient récurrent)', () => {
    const alerts = derivePrescriptionAlerts(
      [presc({ trajets_consommes: 1, date_expiration: '2026-06-20' })],
      TODAY,
      { recurringPatientIds: new Set(['pat1']) },
    );
    expect(alerts[0]!.kind).toBe('renouvellement');
  });
});
