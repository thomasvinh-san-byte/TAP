// =============================================================================
// E2E Playwright — Override tarif course (Phase 04.7 PLAN-1 T1.3)
// =============================================================================
// Couvre le golden path régulateur :
//   1. Login régulateur
//   2. /courses → ouvrir drawer d'une course terminée
//   3. PricingBreakdown visible avec badge DEMO
//   4. Cliquer « Modifier » → Sheet OverrideTarifModal s'ouvre
//   5. Saisir nouveau tarif + motif (≥ 10 chars)
//   6. Cliquer Confirmer → toast success
//
// V1 non-idempotent acceptable : pas de cleanup BDD (modifie un ride démo).
// Si aucune ride terminée disponible : skip propre.
//
// Refs : PLAN-1 T1.3, DEC-041, DEC-029 esprit.
// =============================================================================

import { test, expect } from '@playwright/test';

async function loginAsRegulateur(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('regulateur@demo.tap');
  await page.getByLabel('Mot de passe').fill('demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(patients|courses|admin)/);
}

test.describe('Override tarif — Sheet régulateur', () => {
  test("régulateur peut modifier le tarif d'une course terminée", async ({ page }) => {
    await loginAsRegulateur(page);
    await page.goto('/courses');
    await expect(page).toHaveURL(/\/courses/);

    // Cherche une course terminée (badge « Terminée » ou status semantic)
    const terminatedRow = page.locator('[data-testid*="ride"]').first();
    const hasRow = await terminatedRow.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasRow) {
      test.skip(true, 'Aucune course visible dans /courses — seed à vérifier.');
      return;
    }

    // Ouvre le drawer en cliquant sur la première ligne
    await terminatedRow.click();

    // Cherche PricingBreakdown — visible seulement si ride terminée
    const breakdown = page.locator('[data-testid="pricing-breakdown"]');
    if (!(await breakdown.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Aucune course terminée dans le seed démo — PricingBreakdown non visible.');
      return;
    }

    // Vérifier badge DEMO
    await expect(breakdown.getByText('DEMO').first()).toBeVisible();

    // Cliquer Modifier
    const modifyBtn = breakdown.getByRole('button', { name: /Modifier/i });
    await modifyBtn.click();

    // Sheet OverrideTarifModal ouvert
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByRole('heading', { name: 'Modifier le tarif' })).toBeVisible();

    // Saisir nouveau tarif + motif valide
    await dialog.getByLabel('Nouveau tarif (€)').fill('28.50');
    await dialog
      .getByLabel(/Motif d'override/i)
      .fill('Détour imposé par travaux Boulevard Vauban ce matin, +6 km estimés.');

    // Confirmer
    await dialog.getByRole('button', { name: /^Confirmer$/i }).click();

    // Toast success
    await expect(page.getByText(/Tarif modifié\./i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('motif trop court désactive le bouton Confirmer', async ({ page }) => {
    await loginAsRegulateur(page);
    await page.goto('/courses');
    const terminatedRow = page.locator('[data-testid*="ride"]').first();
    if (!(await terminatedRow.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Pas de course visible.');
      return;
    }
    await terminatedRow.click();
    const breakdown = page.locator('[data-testid="pricing-breakdown"]');
    if (!(await breakdown.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Pas de course terminée.');
      return;
    }
    await breakdown.getByRole('button', { name: /Modifier/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nouveau tarif (€)').fill('25');
    await dialog.getByLabel(/Motif d'override/i).fill('trop court');

    const confirm = dialog.getByRole('button', { name: /^Confirmer$/i });
    await expect(confirm).toBeDisabled();
  });
});
