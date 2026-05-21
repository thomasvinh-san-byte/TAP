/**
 * E2E Playwright — Compteur 72h breach (DPA-05, D-08).
 *
 * Scénario : créer un breach via Server Action (detected_at = now()) →
 * naviguer vers /admin/legal/breaches → assert le compteur affiche « J-2 »
 * (≥ 48h restantes) avec la classe sémantique `text-success` (> 24h).
 *
 * État RED Wave 0 : page admin breaches + breach-timer.client.tsx n'existent
 * pas encore (Wave 2).
 */
import { test, expect } from '@playwright/test';

test.describe('admin /admin/legal/breaches — compteur 72h', () => {
  test('le compteur affiche J-2 en classe success quand > 24h restantes', async ({ page }) => {
    // Connexion dirigeant Alpha
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('alpha-dir@test.tap');
    await page.getByLabel(/mot de passe/i).fill('test1234!');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();

    // Création breach via UI (formulaire Server Action)
    await page.goto('/admin/legal/breaches');
    await page.getByRole('button', { name: /nouvel incident|nouveau/i }).click();
    await page.getByLabel(/description/i).fill('Accès non autorisé via session compromise');
    await page.getByLabel(/mesures imm[ée]diates/i).fill('Révocation des sessions actives');
    await page.getByLabel(/notification cnil/i).check();
    await page.getByRole('button', { name: /enregistrer|créer/i }).click();

    // Compteur visible avec classe success (> 24h restantes = vert)
    const counter = page.locator('[data-testid="breach-countdown"]').first();
    await expect(counter).toBeVisible();
    await expect(counter).toContainText(/J-?2/);
    await expect(counter).toHaveClass(/text-success/);
  });
});
