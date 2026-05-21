// supabase/functions/nir/index.ts
// Edge Function NIR — dispatcher HTTP authentifié JWT.
// Actions encrypt / decrypt / hash. 401 sans JWT. Audit log forcé sur decrypt
// (impossible à désactiver côté caller). Aucun console.* (T-03-01).

import { serve } from 'std/http/server.ts';
import { decryptNir, encryptNir, hashNir, normalizeNir } from './_shared/crypto.ts';
import { adminClient, AuthError, authenticate, type SupabaseLike } from './_shared/auth.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';

// Re-exports individuels pour les tests Deno (PLAN-1 importe depuis ./index.ts)
export { decryptNir };
export { encryptNir };
export { hashNir };

export interface EncryptResponse {
  nir_encrypted: string;
  nir_search_hash: string;
  nir_last4: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Reconstruit la chaîne base64 depuis le body : string ou array de chars. */
function asEncryptedString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.every((c) => typeof c === 'string')) return value.join('');
  }
  return null;
}

async function handleEncrypt(nir: unknown): Promise<Response> {
  if (typeof nir !== 'string' || nir.length === 0) {
    return jsonResponse({ error: 'NIR invalide' }, 400);
  }
  // nir_last4 calculé côté Edge à partir du NIR normalisé (B-6 fix). Format
  // d'affichage "XX YY" — token non sensible (4 derniers chars + espace).
  const normalized = normalizeNir(nir);
  const last4 = normalized.slice(-4);
  const nir_last4 = `${last4.slice(0, 2)} ${last4.slice(2, 4)}`;
  const nir_encrypted = await encryptNir(nir);
  const nir_search_hash = await hashNir(nir);
  const body: EncryptResponse = { nir_encrypted, nir_search_hash, nir_last4 };
  return jsonResponse(body);
}

async function handleHash(nir: unknown): Promise<Response> {
  if (typeof nir !== 'string' || nir.length === 0) {
    return jsonResponse({ error: 'NIR invalide' }, 400);
  }
  const hash = await hashNir(nir);
  return jsonResponse({ hash });
}

interface DecryptCtx {
  userId: string;
  organizationId: string;
  client: { from: SupabaseLike['from'] };
}

async function handleDecrypt(body: Record<string, unknown>, ctx: DecryptCtx): Promise<Response> {
  const encrypted = asEncryptedString(body.ciphertext ?? body.encrypted);
  const patientId = (body.patient_id ?? body.patientId) as unknown;
  if (!encrypted || typeof patientId !== 'string') {
    return jsonResponse({ error: 'Paramètres invalides' }, 400);
  }
  const nir = await decryptNir(encrypted);
  // Audit log forcé AVANT le return — impossible à oublier côté caller (D-20).
  // Le NIR clair n'est PAS inclus dans metadata (T-03-01).
  await ctx.client.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    action: 'patient.nir.decrypt',
    entity_type: 'patient',
    entity_id: patientId,
    metadata: {},
  });
  return jsonResponse({ nir });
}

export async function handler(req: Request, override?: SupabaseLike): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non supportée' }, 405);
  }

  let auth;
  try {
    auth = await authenticate(req, override);
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : 'Non autorisé';
    return jsonResponse({ error: msg }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON invalide' }, 400);
  }

  // Action explicite dans le body OU dérivée du dernier segment d'URL
  // (/functions/v1/nir/<action>) — supporte les deux conventions.
  const path = new URL(req.url).pathname.replace(/\/$/, '').split('/').pop() ?? '';
  const action = (body.action as string | undefined) ?? path;

  switch (action) {
    case 'encrypt':
      return handleEncrypt(body.nir);
    case 'hash':
      return handleHash(body.nir);
    case 'decrypt': {
      const orgId = (body.organization_id as string | undefined) ?? auth.organizationId;
      const client = override ?? adminClient();
      return handleDecrypt(body, {
        userId: auth.userId,
        organizationId: orgId,
        client,
      });
    }
    default:
      return jsonResponse({ error: 'Action inconnue' }, 400);
  }
}

// Démarrage du serveur HTTP — court-circuité quand le module est importé par
// un test Deno (le test détecte typeof Deno !== "undefined" et import direct).
if (import.meta.main) {
  serve(handler);
}
