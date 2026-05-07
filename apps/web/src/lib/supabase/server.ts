import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@tap/database';

/**
 * Client Supabase pour Server Components et Server Actions.
 * Lit/écrit les cookies via l'API `cookies()` d'App Router.
 */
export function createClient() {
  return createSupabaseServerClient(cookies());
}
