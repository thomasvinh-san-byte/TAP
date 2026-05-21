import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Rate limit portail patient (D-20). Max 5 tentatives par heure et par token.
 * Stockage : table `legal_request_attempts` (créée Plan 02), service_role only.
 * Le hash SHA-256 du token est utilisé pour ne jamais stocker le JWT clair.
 */
function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function checkRateLimit(token: string): Promise<void> {
  const sb = createAdminClient();
  const hash = tokenHash(token);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb
    .from('legal_request_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('token_hash', hash)
    .gte('attempted_at', since);
  if ((count ?? 0) >= 5) {
    throw new Error('Trop de tentatives. Réessayez dans 1 heure.');
  }
  await sb.from('legal_request_attempts').insert({ token_hash: hash, success: false });
}

export async function markAttemptSuccess(token: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from('legal_request_attempts').insert({ token_hash: tokenHash(token), success: true });
}
