/**
 * E2E Playwright — DPIA workflow (DPA-03, D-07).
 *
 * Scénario : dirigeant Alpha → /admin/legal/dpia → crée brouillon →
 * édite Markdown → enregistre → status passe à `validee` → re-edit déclenche
 * une ligne audit_logs (action = 'dpia_record.update').
 *
 * État RED Wave 0 : page + Server Actions DPIA n'existent pas encore (Wave 2).
 */
import { test, expect } from '@playwright/test';

test.describe('admin /admin/legal/dpia — workflow brouillon → validée', () => {
  test('le dirigeant crée, édite et valide une DPIA', async ({ page }) => {
    // Connexion dirigeant Alpha
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('alpha-dir@test.tap');
    await page.getByLabel(/mot de passe/i).fill('test1234!');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();

    // Navigation
    await page.goto('/admin/legal/dpia');
    await expect(
      page.getByRole('heading', { name: /analyse d.impact|dpia/i }),
    ).toBeVisible();

    // Création brouillon
    await page.getByRole('button', { name: /nouvelle dpia|nouveau/i }).click();
    await page
      .getByLabel(/titre/i)
      .fill('Transport sanitaire patients ALD');
    await page.getByLabel(/p[ée]rim[èe]tre|scope/i).fill('Patients dialysés');
    // Markdown body
    await page
      .getByRole('textbox', { name: /risques|markdown/i })
      .fill('## Risques\n\n- Accès non autorisé\n- Fuite NIR');
    await page.getByRole('button', { name: /enregistrer/i }).click();

    // Status brouillon visible
    await expect(page.getByText(/brouillon/i)).toBeVisible();

    // Validation
    await page.getByRole('button', { name: /valider/i }).click();
    await expect(page.getByText(/validée|validee/i)).toBeVisible();

    // Re-édition génère un audit log (vérification indirecte : badge audit
    // affiché ou compteur d'historique > 1)
    await page.getByRole('button', { name: /modifier|éditer/i }).click();
    await page.getByLabel(/titre/i).fill('Transport sanitaire patients ALD V2');
    await page.getByRole('button', { name: /enregistrer/i }).click();

    await expect(
      page.getByText(/historique|modifications|audit/i).first(),
    ).toBeVisible();
  });
});
