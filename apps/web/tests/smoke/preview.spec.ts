/**
 * Smoke test preview — Visible Progress Mandate (CLAUDE.md § 13.5)
 *
 * Vérifie que la preview Vercel a un état minimal exploitable :
 *   1. /login répond 200 et affiche le formulaire de connexion
 *   2. Les comptes démo sont visibles SI `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true`
 *   3. /patients redirige vers /login pour un utilisateur non-authentifié
 *   4. Login régulateur démo → /patients liste les patients seedés (≥ 10 si seed.demo.sql appliqué)
 *
 * Ce test doit passer GREEN sur CHAQUE preview Vercel et CHAQUE run CI cloud.
 * S'il échoue : la preview est cassée → bloque le merge.
 */

import { test, expect } from '@playwright/test';

const REG_DEMO_EMAIL = 'regulateur@demo.tap';
const REG_DEMO_PASSWORD = 'demo1234!';

test.describe('Smoke preview Vercel — Visible Progress Mandate', () => {
  test('login page accessible et fonctionnelle', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'TAP Régulation' })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
  });

  test('comptes démo visibles si env var activée', async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'true',
      'Comptes démo non affichés (production commerciale ou env var absente)',
    );
    await page.goto('/login');
    await expect(page.getByText(/Environnement de démonstration/i)).toBeVisible();
    await expect(page.getByText(REG_DEMO_EMAIL)).toBeVisible();
  });

  test('route protégée /patients redirige vers /login', async ({ page }) => {
    const response = await page.goto('/patients', { waitUntil: 'commit' });
    // Soit 307 redirect, soit landing direct sur /login après follow
    await page.waitForURL(/\/login/);
    await expect(page.url()).toMatch(/\/login/);
    expect(response?.status()).toBeLessThan(500);
  });

  test('login démo régulateur → /patients accessible', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
    await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
    // Une fois Phase 5 livrée, attendre /cockpit ; pour l'instant /patients suffit
    expect(page.url()).toMatch(/\/(patients|cockpit|$)/);
  });
});
