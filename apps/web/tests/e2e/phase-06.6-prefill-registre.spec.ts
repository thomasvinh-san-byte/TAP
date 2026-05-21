// =============================================================================
// E2E Playwright — Pré-remplissage du registre des traitements (Phase 06.6 W2)
// =============================================================================
// Golden path « revue puis insertion » (D-02b) :
//   1. Login dirigeant
//   2. /admin/legal/registre vide → bouton « Pré-remplir »
//   3. Écran de revue : disclaimer + 6 cartes
//   4. Décocher une entrée (cookies)
//   5. Insérer les 5 entrées cochées
//   6. Registre peuplé à 5 entrées, bouton « Pré-remplir » disparu (D-09)
//
// Test non idempotent (V1 — pattern repo, cf. override-tarif.spec.ts) :
// si le registre est déjà peuplé (run précédent sans redéploiement), skip
// propre. Sur une preview fraîche, le registre est vide et le test s'exécute.
//
// Refs : PLAN-2, 06.6-CONTEXT.md (D-02b/D-07/D-08/D-09), CLAUDE.md §9.
// =============================================================================

import { test, expect } from '@playwright/test';

async function loginAsDirigeant(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('dirigeant@demo.tap');
  await page.getByLabel('Mot de passe').fill('demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(patients|courses|admin|cockpit)/);
}

test.describe('Pré-remplissage du registre des traitements', () => {
  test('le dirigeant pré-remplit le registre en écartant une entrée', async ({ page }) => {
    await loginAsDirigeant(page);
    await page.goto('/admin/legal/registre');

    const prefillLink = page.getByRole('link', {
      name: /Pré-remplir avec les traitements types/i,
    });
    if (!(await prefillLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Registre déjà peuplé — test non idempotent V1.');
      return;
    }

    // Écran de revue
    await prefillLink.click();
    await page.waitForURL(/\/admin\/legal\/registre\/pre-remplir/);

    // Disclaimer de non-certification (D-07) + 6 cartes
    await expect(page.getByText(/ne constitue pas un conseil juridique/i)).toBeVisible();
    await expect(page.locator('[data-testid="prefill-card"]')).toHaveCount(6);

    // Décocher l'entrée 6 (consentement aux cookies — index 5)
    await page.getByTestId('prefill-include-5').uncheck();

    // Insérer les 5 entrées restantes
    await page.getByRole('button', { name: /Insérer les 5 entrées cochées/i }).click();

    // Retour au registre peuplé : 5 entrées
    await page.waitForURL(/\/admin\/legal\/registre$/);
    await expect(page.locator('tbody tr')).toHaveCount(5);

    // Le déclencheur de pré-remplissage a disparu (D-09 — registre non vide)
    await expect(
      page.getByRole('link', { name: /Pré-remplir avec les traitements types/i }),
    ).toHaveCount(0);
  });
});
