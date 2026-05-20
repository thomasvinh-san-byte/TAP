import { expect, test } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

/**
 * Phase 05.5 — E2E grille tarifaire CGSS (simulateur /admin/tarifs).
 *
 * Test déterministe : le simulateur ne dépend pas du seed courses, il
 * réutilise `computeCgssFromDistance` (fonction pure) avec la grille
 * active. `loginAsRegulateur` est générique (email/password en
 * paramètres) — utilisé ici avec le compte dirigeant pour atteindre
 * `/admin/tarifs` (dirigeant-only).
 *
 * Refs : PLAN-4, 05.5-UI-SPEC Surface C, DEC-057.
 */
test.describe('Phase 05.5 — Tarif CGSS — page /admin/tarifs', () => {
  test('le simulateur recalcule le total en live', async ({ page }) => {
    await loginAsRegulateur(page, 'dirigeant@demo.tap', 'demo1234!');

    await page.goto('/admin/tarifs');
    await page.waitForLoadState('networkidle');

    // La carte « Grille active » affiche le forfait de la grille seedée.
    await expect(page.getByText('Grille active')).toBeVisible();
    await expect(page.getByText('Forfait prise en charge')).toBeVisible();

    // Le simulateur affiche un total.
    await expect(page.getByText('Simulateur')).toBeVisible();
    const distanceInput = page.locator('#sim-distance');
    await expect(distanceInput).toBeVisible();

    // Modifier la distance recalcule le total (live, pas de bouton).
    await distanceInput.fill('25');
    // Le total est rendu — on vérifie la présence d'un montant en euros.
    await expect(page.getByText(/\d+,\d{2}\s*€/).last()).toBeVisible();
  });
});
