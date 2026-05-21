// =============================================================================
// Helper Playwright — login programmatique régulatrice (Phase 1, Wave 0)
// =============================================================================
// Pourquoi : login via UI à chaque test E2E ralentit drastiquement la suite
// (cf. RESEARCH.md §6 et risque "E2E lent" de la table risques). Ce helper
// effectue un POST direct vers Supabase Auth puis pose les cookies que le
// middleware @supabase/ssr de Wave 2 saura lire.
//
// Sécurité (T-01-03 du threat model) : on utilise l'anon key + identifiants
// d'un compte démo seedé. Jamais de service_role pour le login.
// =============================================================================

import type { Page } from '@playwright/test';

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Login programmatique : récupère un access_token Supabase et pose les cookies
 * sb-access-token / sb-refresh-token sur le contexte Playwright.
 *
 * Pas de navigation UI, pas de fillForm — purement HTTP + addCookies.
 */
export async function loginAsRegulateur(
  page: Page,
  email = 'reg-demo@tap.test',
  password = 'demo1234!',
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requis');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login échoué (${response.status}) pour ${email}`);
  }

  const tokens = (await response.json()) as SupabaseTokenResponse;

  await page.context().addCookies([
    {
      name: 'sb-access-token',
      value: tokens.access_token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
    {
      name: 'sb-refresh-token',
      value: tokens.refresh_token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);
}

/**
 * Supprime les cookies d'auth — utile pour tester la redirection /login.
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.context().clearCookies({ name: 'sb-access-token' });
  await page.context().clearCookies({ name: 'sb-refresh-token' });
}
