import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient } from '@tap/database';

/**
 * Middleware Supabase Auth (PKCE flow).
 *
 * Refresh la session si nécessaire et redirige vers /login si non authentifié.
 * Utilise getUser() (validation serveur) et JAMAIS getSession() (qui lit
 * uniquement le cookie sans valider auprès de Supabase Auth).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createSupabaseMiddlewareClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login');

  if (!user && !isAuthRoute) {
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
