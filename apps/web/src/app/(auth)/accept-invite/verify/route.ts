/**
 * Route Handler GET `/accept-invite/verify` (C04).
 *
 * Cible du `redirectTo` magic link Supabase. Pattern officiel :
 * `verifyOtp({ token_hash, type: 'invite' })` consomme le token et crée la
 * session si valide. Le template d'email Supabase doit utiliser
 * `{{ .ConfirmationURL }}` TEL QUEL — construire le lien à la main →
 * « Auth session missing ».
 *
 * Erreurs :
 *   - token absent / type incorrect → redirect /accept-invite?error=invalid_link
 *   - verifyOtp échec (expiré / déjà consommé) → redirect ?error=expired
 *   - succès → redirect /accept-invite (rend la page form, session active)
 *
 * NB : on consomme le helper repo `createClient()` (lib/supabase/server)
 * plutôt qu'un `createServerClient` brut — `@supabase/ssr` n'est pas une
 * dépendance directe de `apps/web`, le wrapper centralise la gestion de
 * cookies via `cookies()` de Next.js.
 *
 * Path séparé de `/accept-invite` (page) pour respecter la contrainte
 * Next.js App Router : un dossier ne peut pas exposer simultanément
 * `page.tsx` et `route.ts` au même URL.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  if (!token_hash || type !== 'invite') {
    return NextResponse.redirect(`${url.origin}/accept-invite?error=invalid_link`);
  }

  const supabase = createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: 'invite',
  });
  if (error) {
    return NextResponse.redirect(`${url.origin}/accept-invite?error=expired`);
  }
  return NextResponse.redirect(`${url.origin}/accept-invite`);
}
