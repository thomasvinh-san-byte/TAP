/**
 * Tests Vitest — limitation applicative de la connexion (durcissement force brute).
 *
 * Couvre : refus au-delà du seuil PAR COMPTE et PAR ORIGINE ; empreinte (jamais
 * d'identifiant/IP en clair) ; non-remise à zéro sur succès (le comptage ne filtre
 * jamais sur `success`). Le client admin Supabase est mocké.
 */
import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkLoginThrottle,
  recordLoginAttempt,
  MAX_ATTEMPTS_PER_ACCOUNT,
  MAX_ATTEMPTS_PER_IP,
} from './rate-limit';

const adminMock = createAdminClient as unknown as ReturnType<typeof vi.fn>;

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

// Traces partagées entre le mock et les assertions.
let eqCalls: Array<[string, string]>;
let inserts: Array<Record<string, unknown>>;

function installClient(accountCount: number, ipCount: number) {
  eqCalls = [];
  inserts = [];
  adminMock.mockImplementation(() => ({
    from: () => ({
      select: () => {
        let col = '';
        const builder = {
          eq(c: string, h: string) {
            col = c;
            eqCalls.push([c, h]);
            return builder;
          },
          gte: () =>
            Promise.resolve({
              count: col === 'identifier_hash' ? accountCount : ipCount,
              error: null,
            }),
        };
        return builder;
      },
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return Promise.resolve({ error: null });
      },
    }),
  }));
}

beforeEach(() => {
  adminMock.mockReset();
});

describe('checkLoginThrottle — par compte et par origine', () => {
  it('refuse au-delà du seuil PAR COMPTE (dimension account)', async () => {
    installClient(MAX_ATTEMPTS_PER_ACCOUNT, 0);
    const res = await checkLoginThrottle({ email: 'a@demo.tap', ip: '10.0.0.1' });
    expect(res).toEqual({ limited: true, reason: 'account' });
  });

  it('refuse au-delà du seuil PAR ORIGINE (dimension ip), compte sous le seuil', async () => {
    installClient(0, MAX_ATTEMPTS_PER_IP);
    const res = await checkLoginThrottle({ email: 'a@demo.tap', ip: '10.0.0.1' });
    expect(res).toEqual({ limited: true, reason: 'ip' });
  });

  it('autorise quand les deux dimensions sont sous le seuil', async () => {
    installClient(MAX_ATTEMPTS_PER_ACCOUNT - 1, MAX_ATTEMPTS_PER_IP - 1);
    const res = await checkLoginThrottle({ email: 'a@demo.tap', ip: '10.0.0.1' });
    expect(res).toEqual({ limited: false });
  });

  it('ne remet pas à zéro sur succès : le comptage ne filtre jamais sur `success`', async () => {
    installClient(0, 0);
    await checkLoginThrottle({ email: 'a@demo.tap', ip: '10.0.0.1' });
    // Les seules colonnes filtrées sont les dimensions (compte / origine).
    const columns = eqCalls.map(([c]) => c);
    expect(columns).toEqual(['identifier_hash', 'ip_hash']);
    expect(columns).not.toContain('success');
  });

  it('interroge par EMPREINTE, jamais par identifiant/IP en clair', async () => {
    installClient(0, 0);
    await checkLoginThrottle({ email: 'Alice@Demo.Tap', ip: '10.0.0.1' });
    const idHash = eqCalls[0]?.[1] ?? '';
    const ipH = eqCalls[1]?.[1] ?? '';
    expect(idHash).toBe(sha256('alice@demo.tap')); // normalisé + haché
    expect(ipH).toBe(sha256('10.0.0.1'));
    expect(idHash).not.toContain('demo.tap');
  });
});

describe('recordLoginAttempt — enregistrement haché', () => {
  it('enregistre les empreintes (jamais de clair) + le résultat', async () => {
    installClient(0, 0);
    await recordLoginAttempt({ email: 'Bob@Demo.Tap', ip: '203.0.113.7', success: true });
    expect(inserts).toHaveLength(1);
    const row = inserts[0];
    expect(row).toBeDefined();
    if (!row) return;
    expect(row).toEqual({
      identifier_hash: sha256('bob@demo.tap'),
      ip_hash: sha256('203.0.113.7'),
      success: true,
    });
    // Aucune donnée en clair ne doit fuiter dans la ligne stockée.
    expect(JSON.stringify(row)).not.toContain('bob@demo.tap');
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');
    expect(Object.keys(row)).not.toContain('email');
    expect(Object.keys(row)).not.toContain('ip');
  });

  it('propage le résultat d’échec', async () => {
    installClient(0, 0);
    await recordLoginAttempt({ email: 'x@demo.tap', ip: '10.0.0.9', success: false });
    expect(inserts[0]).toMatchObject({ success: false });
  });
});
