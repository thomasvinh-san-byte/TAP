// =============================================================================
// Tests Vitest — rideExpressInputSchema + rideDraftSchema (Phase 2, Plan 1)
// =============================================================================
// Phase 2 / Wave 0 : refonte du stub Phase 0 (courseExpressSchema supprimé).
// Tous les cas doivent passer GREEN au commit (Wave 0 = TDD couche pure).
// Aligné sur D-08 (CONTEXT.md) — schéma SQL Wave 1.
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  rideExpressInputSchema,
  rideDraftSchema,
  rideTransportModeSchema,
  rideUrgencySchema,
} from '../ride';

const baseValide = {
  patient_id: '11111111-1111-1111-1111-111111111111',
  scheduled_at: '2026-05-15T14:30:00+04:00',
  pickup_address: '12 rue Pasteur',
  dropoff_address: 'CHU Bellepierre',
};

describe('rideExpressInputSchema', () => {
  it('1. accepte une saisie minimale et applique les defaults', () => {
    const parsed = rideExpressInputSchema.parse(baseValide);
    expect(parsed.transport_mode).toBe('taxi_conventionne');
    expect(parsed.urgency).toBe('programmee');
    expect(parsed.patient_id).toBe(baseValide.patient_id);
  });

  it('2. refuse un patient_id non-UUID avec message « Patient requis »', () => {
    const result = rideExpressInputSchema.safeParse({
      ...baseValide,
      patient_id: 'pas-un-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Patient requis');
    }
  });

  it('3. refuse scheduled_at sans offset avec message « Date/heure requise »', () => {
    const result = rideExpressInputSchema.safeParse({
      ...baseValide,
      scheduled_at: '2026-05-15T14:30:00', // pas d'offset
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Date/heure requise');
    }
  });

  it('4. refuse pickup_address < 3 chars', () => {
    const result = rideExpressInputSchema.safeParse({
      ...baseValide,
      pickup_address: 'ab',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Adresse de prise en charge requise');
    }
  });

  it('5. refuse dropoff_address vide', () => {
    const result = rideExpressInputSchema.safeParse({
      ...baseValide,
      dropoff_address: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Adresse de destination requise');
    }
  });

  it('6. refuse pickup_postal_code hors Réunion (75001)', () => {
    const result = rideExpressInputSchema.safeParse({
      ...baseValide,
      pickup_postal_code: '75001',
    });
    expect(result.success).toBe(false);
  });

  it('7. refuse notes_regulateur > 500 chars', () => {
    const longue = 'a'.repeat(501);
    const result = rideExpressInputSchema.safeParse({
      ...baseValide,
      notes_regulateur: longue,
    });
    expect(result.success).toBe(false);
  });
});

describe('rideTransportModeSchema', () => {
  it('8. accepte les 4 modes attendus et refuse les valeurs legacy', () => {
    expect(rideTransportModeSchema.parse('taxi_conventionne')).toBe('taxi_conventionne');
    expect(rideTransportModeSchema.parse('tpmr')).toBe('tpmr');
    expect(rideTransportModeSchema.parse('vsl')).toBe('vsl');
    expect(rideTransportModeSchema.parse('ambulance')).toBe('ambulance');
    // Valeurs Phase 0 stub supprimées :
    expect(() => rideTransportModeSchema.parse('assis')).toThrow();
    expect(() => rideTransportModeSchema.parse('tpmr_old')).toThrow();
  });
});

describe('rideUrgencySchema', () => {
  it('9. accepte programmee / urgente / immediate', () => {
    expect(rideUrgencySchema.parse('programmee')).toBe('programmee');
    expect(rideUrgencySchema.parse('urgente')).toBe('urgente');
    expect(rideUrgencySchema.parse('immediate')).toBe('immediate');
    expect(() => rideUrgencySchema.parse('autre')).toThrow();
  });
});

describe('rideDraftSchema (D-02)', () => {
  it('10. accepte un brouillon avec uniquement {patient_id} ou {} vide', () => {
    expect(() => rideDraftSchema.parse({ patient_id: baseValide.patient_id })).not.toThrow();
    expect(() => rideDraftSchema.parse({})).not.toThrow();
  });
});
