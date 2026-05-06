import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './types';

interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
}

/**
 * Client Supabase côté serveur, lié aux cookies de la requête en cours.
 * À fournir par l'app Next.js (cookieStore récupéré via `cookies()` d'App Router).
 */
export function createSupabaseServerClient(cookieStore: CookieStoreLike) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.',
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Server Components en lecture seule : ignorer.
        }
      },
      remove(name, options) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        } catch {
          // idem.
        }
      },
    },
  });
}
