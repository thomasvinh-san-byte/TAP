import { SignJWT, jwtVerify } from 'jose';

/**
 * Helpers JWT HS256 pour le portail patient (D-10, D-20).
 * Le token signé identifie une `patient_data_request` ; le serveur résout
 * les autres champs en DB. JAMAIS de PII (email, patient_id, NIR, nom)
 * dans les claims (RESEARCH § Pitfall 1, T-1.5-10).
 *
 * Secret : `APP_LEGAL_TOKEN_SECRET` (≥ 32 bytes, distinct des clés NIR).
 * Algorithme strict HS256 — verify rejette HS512/RS256/none (T-1.5-09).
 */
export type RequestTokenClaims = {
  sub: string; // patient_data_request.id (UUID)
  org: string; // organization_id
  type: string; // request_type (acces, effacement, ...)
};

function getSecret(): Uint8Array {
  const secret = process.env.APP_LEGAL_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('APP_LEGAL_TOKEN_SECRET manquant ou trop court (≥ 32 bytes requis).');
  }
  return new TextEncoder().encode(secret);
}

/** Signe un token portail patient valide 30 jours (D-10, art. 12 RGPD). */
export async function signRequestToken(claims: RequestTokenClaims): Promise<string> {
  return new SignJWT({ sub: claims.sub, org: claims.org, type: claims.type })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

/** Vérifie un token et retourne les claims typés. Throw si invalide/expiré. */
export async function verifyRequestToken(token: string): Promise<RequestTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
    clockTolerance: 60,
  });
  const { sub, org, type } = payload as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof org !== 'string' || typeof type !== 'string') {
    throw new Error('Claims du token incomplets.');
  }
  return { sub, org, type };
}
