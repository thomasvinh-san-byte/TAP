import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Helper idempotency pour Route Handlers Phase 04.9 Wave 1.
 *
 * Pattern : avant d'appliquer la mutation, on cherche dans `idempotency_keys`
 * s'il existe déjà une réponse cached pour (user_id, mutation_type,
 * resource_id, key). Si oui, retour de la réponse cached avec flag
 * `cached: true`. Sinon, application de la mutation puis INSERT de la
 * réponse avant retour.
 *
 * Garantie : 2 fetch même UUID v4 → 1 UPDATE BDD, 1 cache hit. Critique
 * pour PWA offline retry après timeout incertain (réseau qui revient
 * pendant que le client retry une mutation qui avait déjà abouti côté
 * serveur).
 *
 * Refs : PLAN-1.md, DEC-045 LOCKED, migration 20260518000002.
 */

export interface IdempotencyParams<T> {
  key: string;
  userId: string;
  // PWA-01 (§5.16) : ajout des transitions intermédiaires arrive/board.
  mutationType: 'start_ride' | 'arrive_ride' | 'board_ride' | 'end_ride' | 'no_show_ride';
  resourceId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>;
  fn: () => Promise<{ status: number; body: T }>;
}

export interface IdempotencyResult<T> {
  status: number;
  body: T & { cached?: boolean };
}

type CachedRow = { response_json: { status: number; body: Record<string, unknown> } };

export async function withIdempotency<T extends Record<string, unknown>>(
  params: IdempotencyParams<T>,
): Promise<IdempotencyResult<T>> {
  const { key, userId, mutationType, resourceId, supabase, fn } = params;

  const { data: cached, error: cachedError } = await supabase
    .from('idempotency_keys')
    .select('response_json')
    .eq('key', key)
    .eq('user_id', userId)
    .eq('mutation_type', mutationType)
    .eq('resource_id', resourceId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();
  if (cachedError) {
    console.error('[idempotency/cache] Erreur Supabase:', cachedError);
  }

  const cachedRow = (cached as CachedRow | null) ?? null;
  if (cachedRow) {
    return {
      status: cachedRow.response_json.status,
      body: { ...(cachedRow.response_json.body as T), cached: true },
    };
  }

  const result = await fn();

  if (result.status >= 200 && result.status < 300) {
    await supabase.from('idempotency_keys').insert({
      key,
      user_id: userId,
      mutation_type: mutationType,
      resource_id: resourceId,
      response_json: { status: result.status, body: result.body },
    } as never);
  }

  return result;
}
