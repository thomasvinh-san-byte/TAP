// =============================================================================
// Playwright config — apps/web (Phase 1, Wave 0 RED scaffold)
// =============================================================================
// État RED en Wave 0 : apps/web/app/* n'existe pas encore (Wave 2 livrera le
// bootstrap Next.js + middleware Supabase auth). Cette config est posée
// d'avance pour éviter qu'un executor de Wave 3 invente la commande.
//
// webServer lance simultanément :
//   1. le dev server Next.js (apps/web)
//   2. l'Edge Function NIR (supabase functions serve nir)
// via `concurrently` — sans ça, le test E2E échoue à l'étape de création de
// patient (NIR injoignable). cf. Revision Log itération 1/3 du PLAN.
// =============================================================================

import { defineConfig, devices } from '@playwright/test';

// Smoke sur preview (CLAUDE.md §13.5) : quand `PLAYWRIGHT_BASE_URL` cible une
// preview Vercel déjà déployée, on teste CETTE URL et on ne démarre AUCUN
// serveur local (le `webServer` `pnpm dev` + `supabase functions serve` ne peut
// pas tourner dans le runner smoke). Sans cette variable (dev local, E2E), le
// comportement historique est conservé : baseURL locale + webServer.
const previewBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  // Phase 1.5 : ouvrir le testDir à la fois pour les tests historiques
  // (e2e/ — Phase 1) et les tests RGPD (tests/admin/, tests/public/,
  // tests/portail/ — Phase 1.5). Le glob par défaut **/*.spec.ts est
  // automatiquement appliqué à toutes les arborescences.
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: previewBaseUrl ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    locale: 'fr-FR',
    timezoneId: 'Indian/Reunion',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Contre une preview déjà déployée : aucun serveur local à lancer.
  webServer: previewBaseUrl
    ? undefined
    : {
        // eslint-disable-next-line max-len
        command:
          'npx concurrently --kill-others-on-fail "pnpm -C apps/web dev" "supabase functions serve nir --env-file .env.local --no-verify-jwt"',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          APP_NIR_ENCRYPTION_KEY: process.env.APP_NIR_ENCRYPTION_KEY ?? '',
          APP_NIR_SEARCH_KEY: process.env.APP_NIR_SEARCH_KEY ?? '',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
      },
});
