import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasActiveSmsConsent, isConsentValid, getActiveSmsConsentMap } from '../consent-checker';

function mockSupabase(result: {
  data: { consentement_sms: boolean | null; consentement_sms_at: string | null } | null;
  error: unknown;
}): SupabaseClient {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(builder),
  } as unknown as SupabaseClient;
}

describe('hasActiveSmsConsent', () => {
  it('renvoie true quand consentement actif + horodaté', async () => {
    const supabase = mockSupabase({
      data: { consentement_sms: true, consentement_sms_at: '2026-05-19T00:00:00Z' },
      error: null,
    });
    expect(await hasActiveSmsConsent(supabase, 'p-1')).toBe(true);
  });

  it('renvoie false quand consentement révoqué (false)', async () => {
    const supabase = mockSupabase({
      data: { consentement_sms: false, consentement_sms_at: '2026-05-19T00:00:00Z' },
      error: null,
    });
    expect(await hasActiveSmsConsent(supabase, 'p-1')).toBe(false);
  });

  it('renvoie false quand consentement_sms_at est null (défensif)', async () => {
    const supabase = mockSupabase({
      data: { consentement_sms: true, consentement_sms_at: null },
      error: null,
    });
    expect(await hasActiveSmsConsent(supabase, 'p-1')).toBe(false);
  });

  it('renvoie false quand patient non trouvé', async () => {
    const supabase = mockSupabase({ data: null, error: null });
    expect(await hasActiveSmsConsent(supabase, 'inconnu')).toBe(false);
  });

  it('renvoie false (fail-safe) sur erreur Supabase', async () => {
    const supabase = mockSupabase({ data: null, error: new Error('network') });
    expect(await hasActiveSmsConsent(supabase, 'p-1')).toBe(false);
  });
});

describe('isConsentValid (règle pure, source unique)', () => {
  it('true : consentement true + horodaté', () => {
    expect(
      isConsentValid({ consentement_sms: true, consentement_sms_at: '2026-05-19T00:00:00Z' }),
    ).toBe(true);
  });
  it('false : consentement révoqué', () => {
    expect(
      isConsentValid({ consentement_sms: false, consentement_sms_at: '2026-05-19T00:00:00Z' }),
    ).toBe(false);
  });
  it('false : horodatage manquant', () => {
    expect(isConsentValid({ consentement_sms: true, consentement_sms_at: null })).toBe(false);
  });
  it('false : ligne nulle/indéfinie', () => {
    expect(isConsentValid(null)).toBe(false);
    expect(isConsentValid(undefined)).toBe(false);
  });
});

describe('getActiveSmsConsentMap (batch — crons rappel, DEC-156)', () => {
  function mockInClient(result: { data: unknown; error: unknown }): SupabaseClient {
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue(result),
    };
    return { from: vi.fn().mockReturnValue(builder) } as unknown as SupabaseClient;
  }

  it('Map vide si aucun patientId (aucune requête)', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const map = await getActiveSmsConsentMap(supabase, []);
    expect(map.size).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('mappe chaque patient à sa validité (même règle que isConsentValid)', async () => {
    const supabase = mockInClient({
      data: [
        { id: 'a', consentement_sms: true, consentement_sms_at: '2026-05-19T00:00:00Z' },
        { id: 'b', consentement_sms: false, consentement_sms_at: '2026-05-19T00:00:00Z' },
        { id: 'c', consentement_sms: true, consentement_sms_at: null },
      ],
      error: null,
    });
    const map = await getActiveSmsConsentMap(supabase, ['a', 'b', 'c']);
    expect(map.get('a')).toBe(true);
    expect(map.get('b')).toBe(false);
    expect(map.get('c')).toBe(false);
  });

  it('patient introuvable → absent de la Map (caller le traite comme non-consentant)', async () => {
    const supabase = mockInClient({
      data: [{ id: 'a', consentement_sms: true, consentement_sms_at: '2026-05-19T00:00:00Z' }],
      error: null,
    });
    const map = await getActiveSmsConsentMap(supabase, ['a', 'z']);
    expect(map.get('a')).toBe(true);
    expect(map.has('z')).toBe(false);
  });

  it('throw sur erreur de lecture (fail-safe : le cron doit abandonner, pas envoyer)', async () => {
    const supabase = mockInClient({ data: null, error: new Error('db down') });
    await expect(getActiveSmsConsentMap(supabase, ['a'])).rejects.toThrow();
  });
});
