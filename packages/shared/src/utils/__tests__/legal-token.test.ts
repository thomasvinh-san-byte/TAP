/**
 * Tests unitaires `legal-token` (Phase 1.5, D-10, RESEARCH §1).
 *
 * Couvre 5 cas critiques :
 *   1. signRequestToken puis verifyRequestToken d'un token valide retourne
 *      les claims sub/org/type.
 *   2. Un token expiré est rejeté (`exp` antérieur à now()).
 *   3. Un token avec signature corrompue (dernier caractère modifié) est rejeté.
 *   4. Un token totalement malformé (string aléatoire) est rejeté.
 *   5. Un token signé en HS512 (algorithme non autorisé) est rejeté.
 *
 * État RED Wave 0 : le module `../legal-token` n'existe pas encore. Le
 * planner livrera `signRequestToken` et `verifyRequestToken` en Wave 1 dans
 * `packages/shared/src/utils/legal-token.ts` avec la lib `jose@6.2.3`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';

// Import RED — le fichier sera créé en Wave 1
import { signRequestToken, verifyRequestToken } from '../legal-token';

const TEST_SECRET = 'a'.repeat(32);
let originalSecret: string | undefined;

beforeAll(() => {
  originalSecret = process.env.APP_LEGAL_TOKEN_SECRET;
  process.env.APP_LEGAL_TOKEN_SECRET = TEST_SECRET;
});

afterAll(() => {
  if (originalSecret === undefined) {
    delete process.env.APP_LEGAL_TOKEN_SECRET;
  } else {
    process.env.APP_LEGAL_TOKEN_SECRET = originalSecret;
  }
});

describe('legal-token', () => {
  it('signe puis vérifie un token valide avec sub/org/type', async () => {
    const token = await signRequestToken({
      sub: 'request-id-1',
      org: 'org-alpha',
      type: 'acces',
    });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await verifyRequestToken(token);
    expect(payload.sub).toBe('request-id-1');
    expect(payload.org).toBe('org-alpha');
    expect(payload.type).toBe('acces');
  });

  it('rejette un token expiré', async () => {
    const secretBytes = new TextEncoder().encode(TEST_SECRET);
    const expired = await new SignJWT({
      sub: 'req-2',
      org: 'org-alpha',
      type: 'acces',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 60)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60 * 60 * 24)
      .sign(secretBytes);

    await expect(verifyRequestToken(expired)).rejects.toThrow();
  });

  it('rejette un token avec signature invalide', async () => {
    const token = await signRequestToken({
      sub: 'req-3',
      org: 'org-alpha',
      type: 'acces',
    });
    const last = token.charCodeAt(token.length - 1);
    const flipped = String.fromCharCode(last === 65 ? 66 : last - 1);
    const corrupted = token.slice(0, -1) + flipped;

    await expect(verifyRequestToken(corrupted)).rejects.toThrow();
  });

  it('rejette un token malformé', async () => {
    await expect(verifyRequestToken('not-a-jwt-at-all')).rejects.toThrow();
    await expect(verifyRequestToken('')).rejects.toThrow();
    await expect(verifyRequestToken('aa.bb.cc')).rejects.toThrow();
  });

  it('rejette un token avec algo HS512 (algorithme non autorisé)', async () => {
    const secretBytes = new TextEncoder().encode(TEST_SECRET);
    const wrongAlg = await new SignJWT({
      sub: 'req-5',
      org: 'org-alpha',
      type: 'acces',
    })
      .setProtectedHeader({ alg: 'HS512' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secretBytes);

    await expect(verifyRequestToken(wrongAlg)).rejects.toThrow();
  });
});
