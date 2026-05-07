/**
 * E2E Playwright — Export PDF du registre des traitements (DPA-01, D-17).
 *
 * Scénario : un dirigeant Alpha se connecte → ouvre /admin/legal/registre →
 * clique le bouton « Exporter PDF » → la réponse est un PDF (Content-Type
 * application/pdf) avec status 200.
 *
 * État RED Wave 0 : la page admin et la route /api/admin/legal/registre/pdf
 * n'existent pas encore (Wave 2). Le test échoue jusqu'à la livraison.
 */
import { test, expect } from '@playwright/test';

test.describe('admin /admin/legal/registre — export PDF', () => {
  test('le dirigeant peut exporter le registre au format PDF', async ({
    page,
  }) => {
    // Connexion dirigeant Alpha (helper fourni par e2e/helpers en Wave 2)
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('alpha-dir@test.tap');
    await page.getByLabel(/mot de passe/i).fill('test1234!');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();

    // Navigation vers la page registre
    await page.goto('/admin/legal/registre');
    await expect(
      page.getByRole('heading', { name: /registre des traitements/i }),
    ).toBeVisible();

    // Click bouton « Exporter PDF » → intercept response
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/admin/legal/registre/pdf') &&
          resp.status() === 200,
      ),
      page.getByRole('button', { name: /exporter pdf|export pdf/i }).click(),
    ]);

    expect(response.headers()['content-type']).toContain('application/pdf');
  });
});
