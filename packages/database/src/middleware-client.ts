import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from './types';

/**
 * Client Supabase pour le middleware Next.js.
 *
 * À utiliser uniquement depuis `apps/web/middleware.ts` (ADR-001 :
 * `apps/*` consomment exclusivement `packages/*`, jamais `@supabase/*`
 * directement). Le client lit les cookies de la requête entrante et écrit
 * les cookies de réponse mis à jour par `getUser()` (refresh de session).
 */
export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.',
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options?: CookieOptions) {
        res.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
}
