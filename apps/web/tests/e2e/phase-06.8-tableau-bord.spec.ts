// =============================================================================
// E2E Playwright — Tableau de bord dirigeant (Phase 06.8 Wave 2)
// =============================================================================
// Golden path :
//   1. Login dirigeant
//   2. Atterrissage automatique sur /tableau-de-bord (redirection par rôle —
//      DEC-071)
//   3. Blocs « À traiter » + « Activité » + carte Conformité présents
//   4. Le lien d'action « Facturer » mène à /admin/facturation
//
// Le tableau de bord se rend toujours (getDashboardData renvoie des valeurs
// de repli) — test déterministe, pas de skip.
//
// Refs : PLAN-2, 06.8-CONTEXT.md (D-01/D-02/D-05), CLAUDE.md §9.
// =============================================================================

import { test, expect } from '@playwright/test';

async function loginAsDirigeant(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('dirigeant@demo.tap');
  await page.getByLabel('Mot de passe').fill('demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/tableau-de-bord/, { timeout: 10_000 });
}

test.describe('Tableau de bord dirigeant', () => {
  test('le dirigeant atterrit sur le tableau de bord et atteint la facturation', async ({
    page,
  }) => {
    await loginAsDirigeant(page);

    // Atterrissage par rôle (DEC-071)
    await expect(page).toHaveURL(/\/tableau-de-bord/);

    // En-tête + blocs + carte conformité
    await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'À traiter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activité' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conformité RGPD' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Courses à facturer' })).toBeVisible();

    // Le lien d'action mène à la page d'action
    await page.getByRole('link', { name: /^Facturer/ }).click();
    await expect(page).toHaveURL(/\/admin\/facturation/);
  });
});
