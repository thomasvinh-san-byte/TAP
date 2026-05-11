import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient } from '@tap/database';

/**
 * Middleware Supabase Auth (PKCE flow).
 *
 * Refresh la session si nécessaire et redirige vers /login si non authentifié.
 * Utilise getUser() (validation serveur) et JAMAIS getSession() (qui lit
 * uniquement le cookie sans valider auprès de Supabase Auth).
 *
 * Tolérance config absente : si NEXT_PUBLIC_SUPABASE_* manquent au runtime
 * (env vars Vercel pas encore posées par exemple), on redirige vers /welcome
 * au lieu de jeter un 500 MIDDLEWARE_INVOCATION_FAILED. Ça permet au moins
 * d'afficher quelque chose à un visiteur qui tombe sur la preview pendant
 * la phase de config initiale.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pages toujours accessibles sans Supabase (statiques / setup)
  const isWelcome = pathname === '/welcome';
  const isSetup = pathname === '/setup';

  // Détection précoce env vars absentes — pas de Supabase = redirect /welcome
  // Stratégie de bring-up :
  //   1. Sans env vars        → /welcome (« connecte Vercel à Supabase »)
  //   2. Avec env vars + DB vide → /setup (bouton « Initialiser »)
  //   3. Avec env vars + DB OK  → /login (comportement normal)
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseConfigured) {
    if (isWelcome) {
      return NextResponse.next();
    }
    const welcomeUrl = request.nextUrl.clone();
    welcomeUrl.pathname = '/welcome';
    welcomeUrl.search = '';
    return NextResponse.redirect(welcomeUrl);
  }

  // Si env vars OK et user tape /welcome, on le pousse vers /setup pour
  // débloquer la dernière étape. /setup détecte si la DB est vide et soit
  // affiche le bouton init, soit redirect vers /login.
  if (isWelcome) {
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = '/setup';
    setupUrl.search = '';
    return NextResponse.redirect(setupUrl);
  }

  // /setup reste toujours accessible — c'est lui qui détecte l'état DB.
  if (isSetup) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createSupabaseMiddlewareClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname.startsWith('/login');
  // D-21 : pages /legal/* publiques (SSG) — pas de redirect login.
  // Strict startsWith('/legal') — `/legalX` (sans slash) reste protégé.
  const isPublicLegal =
    pathname === '/legal' || pathname.startsWith('/legal/');
  // Route API consent cookies : POST anonyme avant authentification.
  const isLegalApi = pathname.startsWith('/api/legal/cookie-consent');

  if (!user && !isAuthRoute && !isPublicLegal && !isLegalApi && !isWelcome) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/patients';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
