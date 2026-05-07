// =============================================================================
// E2E Playwright — Saisie express course (Phase 2, Plan 02-01, Wave 0 RED)
// =============================================================================
// État Wave 0 : tous les tests sont en `test.skip` ; ils passeront GREEN à
// la Wave 5 (livraison du modal RideExpressModal + orchestrateur multi-
// instance + raccourci global + page /courses).
//
// La config apps/web/playwright.config.ts impose déjà :
//   - locale: 'fr-FR'
//   - timezoneId: 'Indian/Reunion'
//   - webServer concurrent (Next.js dev + Edge Function nir)
//
// Le scaffold mappe SAIS-01..06 au test.skip explicite pour que la Wave 5
// puisse simplement remplacer chaque .skip par une implémentation.
// =============================================================================

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const REG_DEMO_EMAIL = 'regulateur@demo.tap';
const REG_DEMO_PASSWORD = 'demo1234!';

async function loginRegulateur(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

test.describe('Saisie express course (SAIS-01..06)', () => {
  test.beforeEach(async ({ page }) => {
    await loginRegulateur(page);
  });

  test.skip('SAIS-01 saisie complète < 30 s', async ({ page }) => {
    // Wave 5 : ouvrir modal via Cmd+Shift+K, remplir 5 champs, submit,
    // assert toast « Course créée » + Date.now() - t0 < 30_000.
    expect(page).toBeTruthy();
  });

  test.skip('SAIS-02 raccourci global Cmd/Ctrl+Shift+K', async ({ page }) => {
    // Wave 5 : depuis n'importe quelle route (app), presser Control+Shift+K
    // → modal visible (role="dialog") en moins de 500 ms.
    expect(page).toBeTruthy();
  });

  test.skip('SAIS-03 recherche patient 2 chars dans modal', async ({
    page,
  }) => {
    // Wave 5 : taper « Ho » dans le champ patient → résultat « Hoarau »
    // visible (réutilise PatientSearch Phase 1).
    expect(page).toBeTruthy();
  });

  test.skip('SAIS-04 brouillon reprise après pause', async ({ page }) => {
    // Wave 5 : ouvrir modal, remplir 2 champs, fermer (Esc) → DraftQueue
    // badge passe à 1, click brouillon → modal réouvre avec valeurs.
    expect(page).toBeTruthy();
  });

  test.skip('SAIS-05 multi-saisies parallèles compteur badge', async ({
    page,
  }) => {
    // Wave 5 : 3 fois Control+Shift+K → DraftQueue badge = 2 (le 3e visible,
    // les 2 précédents minimisés et auto-sauvegardés en ride_draft).
    expect(page).toBeTruthy();
  });

  test.skip('SAIS-06 audit log ride.insert créé', async ({ page }) => {
    // Wave 5 : créer une course → assert via API admin (ou Supabase RPC
    // avec rôle dirigeant) qu'audit_logs contient action='ride.insert'
    // et entity_type='ride' avec actor_id = user courant.
    expect(page).toBeTruthy();
  });
});
