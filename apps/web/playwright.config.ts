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

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
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
  webServer: {
    // eslint-disable-next-line max-len
    command: 'npx concurrently --kill-others-on-fail "pnpm -C apps/web dev" "supabase functions serve nir --env-file .env.local --no-verify-jwt"',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_NIR_ENCRYPTION_KEY: process.env.APP_NIR_ENCRYPTION_KEY ?? '',
      APP_NIR_SEARCH_KEY: process.env.APP_NIR_SEARCH_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
});
