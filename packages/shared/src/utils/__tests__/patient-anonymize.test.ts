/**
 * Tests unitaires `anonymizePatient` (Phase 1.5, DPA-04, art. 17 RGPD).
 *
 * Couvre 2 cas :
 *   1. Appelle la RPC rgpd_anonymize_patient avec p_salt depuis env.
 *   2. Throw avec message FR si rpc retourne error.
 *
 * État RED Wave 0 : `../patient-anonymize` n'existe pas encore. Wave 1
 * livrera le helper qui appelle la RPC SQL (transaction atomique côté DB).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import RED — fichier sera créé en Wave 1
import { anonymizePatient } from '../patient-anonymize';

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

function makeMock(opts: { rpcResult: { error: { message: string } | null } }) {
  const calls: RpcCall[] = [];
  const supabase = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return opts.rpcResult;
    },
  } as unknown as Parameters<typeof anonymizePatient>[0];
  return { supabase, calls };
}

describe('anonymizePatient', () => {
  let originalSalt: string | undefined;

  beforeEach(() => {
    originalSalt = process.env.APP_ANONYMIZATION_SALT;
    process.env.APP_ANONYMIZATION_SALT = 'salt-de-test-123';
  });

  afterEach(() => {
    if (originalSalt === undefined) {
      delete process.env.APP_ANONYMIZATION_SALT;
    } else {
      process.env.APP_ANONYMIZATION_SALT = originalSalt;
    }
  });

  it('appelle rpc rgpd_anonymize_patient avec p_salt depuis env', async () => {
    const { supabase, calls } = makeMock({ rpcResult: { error: null } });

    await anonymizePatient(supabase, 'pat-99', 'req-42');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.fn).toBe('rgpd_anonymize_patient');
    expect(calls[0]?.args).toMatchObject({
      p_patient_id: 'pat-99',
      p_request_id: 'req-42',
      p_salt: 'salt-de-test-123',
    });
  });

  it('throw avec message FR si rpc retourne error', async () => {
    const { supabase } = makeMock({
      rpcResult: { error: { message: 'patient introuvable' } },
    });

    await expect(anonymizePatient(supabase, 'pat-x', 'req-x')).rejects.toThrow(
      /[éÉ]chou|impossible|introuvable/i,
    );
  });
});

// Évite l'avertissement Vitest sur l'absence d'utilisation de `vi`.
void vi;
