import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@tap/database';

/**
 * Crée un client Supabase côté serveur (App Router).
 *
 * Phase 06.9 (Next.js 15) : `cookies()` est devenue async — les Request
 * APIs sont toutes awaited désormais. On reste cohérent : `createClient`
 * est async, tous les Server Actions / Route Handlers / RSC consommateurs
 * font `const supabase = await createClient();`. Pas de cast
 * `UnsafeUnwrappedCookies` (D-02).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(cookieStore);
}
