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

describe('rideExpressInputSchema — geocoding DEC-044 (Wave 2 Phase 06.10)', () => {
  it('11. accepte les 6 colonnes coords lat/lng/citycode et les préserve après parse', () => {
    // Scelle le pipeline UI→DB du geocoding :
    // BanSuggestion.{lat,lng,citycode} → AddressPickerField.onSelect → updateField
    // → ride-express-modal payload → rideExpressInputSchema.parse → createRideAction
    // → INSERT public.rides via spread (cf. apps/web/src/app/(app)/courses/actions/create.ts)
    // Si ce test casse, le pipeline est rompu — soit le schema a perdu les coords,
    // soit le spread du Server Action ne les transmet plus.
    const coords = {
      pickup_lat: -20.8825,
      pickup_lng: 55.4513,
      pickup_citycode: '97411',
      dropoff_lat: -21.3393,
      dropoff_lng: 55.4781,
      dropoff_citycode: '97416',
    };
    const parsed = rideExpressInputSchema.parse({ ...baseValide, ...coords });
    expect(parsed.pickup_lat).toBe(coords.pickup_lat);
    expect(parsed.pickup_lng).toBe(coords.pickup_lng);
    expect(parsed.pickup_citycode).toBe(coords.pickup_citycode);
    expect(parsed.dropoff_lat).toBe(coords.dropoff_lat);
    expect(parsed.dropoff_lng).toBe(coords.dropoff_lng);
    expect(parsed.dropoff_citycode).toBe(coords.dropoff_citycode);
  });

  it('12. accepte null sur les 6 colonnes coords (fallback saisie libre sans autocomplete BAN)', () => {
    // D-ADDR-04 : si l'utilisateur tape une adresse hors BAN, AddressPickerField
    // n'appelle pas onSelect — les coords restent null. Le schema doit accepter
    // pour ne pas bloquer la saisie libre.
    const parsed = rideExpressInputSchema.parse({
      ...baseValide,
      pickup_lat: null,
      pickup_lng: null,
      pickup_citycode: null,
      dropoff_lat: null,
      dropoff_lng: null,
      dropoff_citycode: null,
    });
    expect(parsed.pickup_lat).toBeNull();
    expect(parsed.dropoff_citycode).toBeNull();
  });

  it('13. rejette lat hors bornes [-90, 90] ou lng hors bornes [-180, 180]', () => {
    expect(rideExpressInputSchema.safeParse({ ...baseValide, pickup_lat: 91 }).success).toBe(false);
    expect(rideExpressInputSchema.safeParse({ ...baseValide, pickup_lng: -181 }).success).toBe(
      false,
    );
  });
});
