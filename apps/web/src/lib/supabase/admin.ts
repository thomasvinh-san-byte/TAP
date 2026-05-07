import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database';

/**
 * Client Supabase admin (service_role) — bypass RLS.
 *
 * À utiliser UNIQUEMENT côté serveur dans des contextes de confiance :
 * cron, watchdogs, routes publiques qui doivent écrire un log
 * (consentement cookies, breach watchdog, demande RGPD anonyme).
 *
 * Ne JAMAIS exposer service_role au navigateur ni le retourner dans
 * une réponse API. Mutations toujours scopées explicitement.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Identifiants Supabase admin manquants.');
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
