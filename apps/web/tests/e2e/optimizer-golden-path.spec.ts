/**
 * E2E Playwright — optimizer golden path (Phase 06.7 Wave 3)
 *
 * Couvre le parcours complet de la régulatrice :
 *   login → /cockpit → clic Optimiser la journée → proposition affichée
 *   → accepter premier groupement → appliquer → toast succès.
 *
 * Pré-requis : OPTIMIZER_SERVICE_URL configuré dans Vercel preview (Task 0 + Task 4).
 * Ce test est créé en attente de la provision du service Python (DEC-079 gate opérateur).
 * En l'absence de OPTIMIZER_SERVICE_URL, le Route Handler retourne 503 et l'état
 * « error » est affiché — le test attendra un état « result » (timeout 10 s).
 *
 * Compte démo : regulateur@demo.tap / demo1234!
 * data-testid attendus (définis dans Task 2) :
 *   - optimize-day-btn        (cockpit-content.client.tsx)
 *   - optimization-skeleton   (optimization-shell.client.tsx — état loading)
 *   - proposed-group-card     (proposed-group-card.tsx — container)
 *   - group-0-accept          (premier bouton Accepter)
 *   - apply-groupements-btn   (bouton Appliquer les groupements acceptés)
 *   - confirm-apply-btn       (bouton de confirmation du dialog)
 *   - sonner-toast            (toast Sonner id)
 *
 * Refs : CLAUDE.md §9, ADR-003, OPTI-01..05.
 */

import { test, expect, type Page } from '@playwright/test';

const REG_DEMO_EMAIL = 'regulateur@demo.tap';
const REG_DEMO_PASSWORD = 'demo1234!';

async function loginRegulateur(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10_000,
  });
}

test('optimizer golden path', async ({ page }) => {
  // 1. Login régulateur
  await loginRegulateur(page);

  // 2. Naviguer vers le cockpit
  await page.goto('/cockpit');

  // 3. Cliquer « Optimiser la journée »
  const optimizeBtn = page.getByTestId('optimize-day-btn');
  await expect(optimizeBtn).toBeVisible({ timeout: 5_000 });
  await optimizeBtn.click();

  // 4. Vérifier que la page d'optimisation s'ouvre
  await page.waitForURL(/\/cockpit\/optimisation/, { timeout: 5_000 });

  // 5. Déclencher le calcul via le bouton « Lancer le calcul »
  const launchBtn = page.getByRole('button', { name: /lancer le calcul/i });
  if (await launchBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await launchBtn.click();
  }

  // 6. Attendre l'état de chargement (skeleton)
  const skeleton = page.getByTestId('optimization-skeleton');
  // Le skeleton peut apparaître brièvement — on le vérifie si visible
  if (await skeleton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expect(skeleton).toBeVisible();
  }

  // 7. Attendre la première carte de groupement (timeout 10 s — appel solveur)
  const firstCard = page.getByTestId('proposed-group-card').first();
  await expect(firstCard).toBeVisible({ timeout: 15_000 });

  // 8. Accepter le premier groupement
  const acceptBtn = page.getByTestId('group-0-accept');
  await expect(acceptBtn).toBeVisible();
  await acceptBtn.click();

  // 9. Vérifier l'état accepté (data-state="accepted")
  await expect(firstCard).toHaveAttribute('data-state', 'accepted');

  // 10. Cliquer « Appliquer les groupements acceptés »
  const applyBtn = page.getByTestId('apply-groupements-btn');
  await expect(applyBtn).toBeEnabled({ timeout: 2_000 });
  await applyBtn.click();

  // 11. Confirmer dans le dialog
  const confirmBtn = page.getByTestId('confirm-apply-btn');
  await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
  await confirmBtn.click();

  // 12. Vérifier le toast de succès (Sonner)
  await expect(page.getByText(/enregistré/i)).toBeVisible({ timeout: 5_000 });
});
