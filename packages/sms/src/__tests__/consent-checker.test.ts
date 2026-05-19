import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasActiveSmsConsent } from '../consent-checker';

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
