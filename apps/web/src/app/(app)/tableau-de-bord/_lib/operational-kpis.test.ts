import { describe, it, expect } from 'vitest';
import { aggregateOperationalKpis, type OperationalRideRow } from './operational-kpis';

function row(over: Partial<OperationalRideRow>): OperationalRideRow {
  return {
    status: 'terminee',
    no_show_at: null,
    ride_group_id: null,
    ride_recurrence_id: null,
    ...over,
  };
}

describe('aggregateOperationalKpis', () => {
  it('total 0 → tous les taux à 0 (pas de division par zéro)', () => {
    const k = aggregateOperationalKpis([]);
    expect(k.total).toBe(0);
    expect(k.tauxMutualisation).toBe(0);
    expect(k.tauxAnnulation).toBe(0);
    expect(k.tauxPatientAbsent).toBe(0);
    expect(k.annulationParMotif).toEqual([]);
  });

  it('mutualisation = groupe d’au moins 2 courses (un groupe d’une seule ne compte pas)', () => {
    const rows = [
      row({ ride_group_id: 'g1' }),
      row({ ride_group_id: 'g1' }),
      row({ ride_group_id: 'g2' }), // groupe solo → pas mutualisé
      row({}),
    ];
    const k = aggregateOperationalKpis(rows);
    expect(k.mutualisees).toBe(2);
    expect(k.tauxMutualisation).toBe(50); // 2 / 4
  });

  it('annulation : taux + répartition par catégorie de motif (statut)', () => {
    const rows = [
      row({ status: 'annulee_patient' }),
      row({ status: 'annulee_meteo' }),
      row({ status: 'terminee' }),
      row({ status: 'terminee' }),
    ];
    const k = aggregateOperationalKpis(rows);
    expect(k.annulees).toBe(2);
    expect(k.tauxAnnulation).toBe(50);
    expect(k.annulationParMotif).toEqual([
      { statut: 'annulee_patient', label: 'Patient', count: 1 },
      { statut: 'annulee_meteo', label: 'Météo', count: 1 },
    ]);
  });

  it('patient absent dérivé de no_show_at', () => {
    const rows = [row({ no_show_at: '2026-06-01T08:00:00Z' }), row({}), row({}), row({})];
    const k = aggregateOperationalKpis(rows);
    expect(k.patientAbsent).toBe(1);
    expect(k.tauxPatientAbsent).toBe(25);
  });

  it('récurrentes vs ponctuelles via ride_recurrence_id', () => {
    const rows = [row({ ride_recurrence_id: 'r1' }), row({ ride_recurrence_id: 'r1' }), row({})];
    const k = aggregateOperationalKpis(rows);
    expect(k.recurrentes).toBe(2);
    expect(k.ponctuelles).toBe(1);
    expect(k.tauxRecurrentes).toBe(67); // round(2/3*100)
  });
});
