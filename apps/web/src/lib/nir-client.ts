/**
 * Wrapper typé autour de l'Edge Function `nir` (PLAN-3).
 *
 * Contrats :
 *  - `encrypt` : 1 seul appel HTTP qui calcule simultanément le ciphertext,
 *    le hash de recherche déterministe et `nir_last4` (clair, non secret —
 *    "XX YY" pour l'affichage masqué). Persistance atomique des 3 colonnes
 *    côté Server Action (W-1 fix iteration 2/3 du PLAN-5).
 *  - `decrypt` : audit log inséré CÔTÉ Edge Function (T-05-04). Aucun moyen
 *    de bypass côté caller. La fonction NE log JAMAIS le NIR clair.
 *  - `hash` : exposé pour usage futur (recherche dédiée NIR exact). Non
 *    consommé directement par PLAN-5 — le hash est obtenu via `encrypt`.
 *
 * Les 3 actions transitent par `supabase.functions.invoke()` ; le JWT du
 * caller est injecté automatiquement par `@supabase/ssr`. La clé de
 * chiffrement n'apparaît jamais dans le bundle Next.js.
 */
// Type-only import : on infère le type SupabaseClient depuis le wrapper
// `@/lib/supabase/server` pour éviter le couplage à la version exacte de
// @supabase/supabase-js (ADR-001 : apps/* dépendent uniquement de packages/*).
import type { createClient as createServerClient } from '@/lib/supabase/server';

type SupabaseClientLike = ReturnType<typeof createServerClient>;

export interface EncryptResponse {
  /** Ciphertext base64 : `iv (12) || cipher || tag (16)`. */
  nir_encrypted: string;
  /** HMAC-SHA256 du NIR normalisé, base64. */
  nir_search_hash: string;
  /** 2 derniers chiffres du numéro + clé sur 2, format "XX YY". Clair, non secret. */
  nir_last4: string;
}

interface DecryptResponse {
  nir: string;
}

interface HashResponse {
  hash: string;
}

/**
 * Encrypt + hash + last4 en un seul aller-retour.
 * Le NIR clair n'apparaît que dans le body de la requête HTTPS vers l'Edge
 * Function ; il n'est jamais persisté côté Next.js.
 */
export async function encryptAndHashNir(
  supabase: SupabaseClientLike,
  nir: string,
): Promise<EncryptResponse> {
  const { data, error } = await supabase.functions.invoke<EncryptResponse>('nir', {
    body: { action: 'encrypt', nir },
  });
  if (error || !data) throw new Error('Chiffrement NIR impossible');
  return data;
}

/**
 * Déchiffre un NIR pour affichage à la régulatrice. L'Edge Function insère
 * automatiquement une ligne `audit_logs` action='patient.nir.decrypt' liée
 * au `patientId` (cf. PLAN-3) — le caller ne peut pas la sauter.
 */
export async function decryptNir(
  supabase: SupabaseClientLike,
  encrypted: string,
  patientId: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<DecryptResponse>('nir', {
    body: { action: 'decrypt', encrypted, patientId },
  });
  if (error || !data) throw new Error('NIR illisible');
  return data.nir;
}

/**
 * Hash déterministe pour la recherche NIR exacte (pas utilisé en PLAN-5 ;
 * conservé pour la Phase 2 saisie express qui pourra réutiliser ce wrapper).
 */
export async function hashNir(supabase: SupabaseClientLike, nir: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<HashResponse>('nir', {
    body: { action: 'hash', nir },
  });
  if (error || !data) throw new Error('Hash NIR impossible');
  return data.hash;
}
