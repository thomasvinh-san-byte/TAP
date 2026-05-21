import { expect, test } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

/**
 * Phase 05 Wave 3 — E2E récurrence dialyse 3×/sem avec saut jour férié 974.
 *
 * Scénario :
 *  1. Régulateur se connecte
 *  2. Ouvre la fiche d'un patient seedé (premier patient retourné par
 *     /patients pour éviter NFR-001 — pas de nom hardcodé)
 *  3. Crée une récurrence Lun/Mer/Ven 08h00 démarrant 2026-04-27 (lundi
 *     avant le 1er mai = jour férié 974)
 *  4. Vérifie que la preview affiche au moins une mention « jour férié »
 *     (le 1er mai 2026 vendredi est dans les occurrences)
 *  5. Soumet et vérifie le retour sur la fiche patient
 */
test('régulatrice crée récurrence dialyse 3×/sem avec saut jour férié 974', async ({ page }) => {
  await loginAsRegulateur(page);

  await page.goto('/patients');
  await page.waitForLoadState('networkidle');

  // Premier lien patient sur la liste (NFR-001 : pas de nom hardcodé)
  const firstPatientLink = page.locator('a[href^="/patients/"]:not([href$="/edit"])').first();
  await firstPatientLink.click();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Nouvelle récurrence/i }).click();

  // Lun/Mer/Ven déjà sélectionnés par défaut — vérifions
  for (const day of ['MO', 'WE', 'FR']) {
    const btn = page.locator(`button[data-day="${day}"]`);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  }

  await page.locator('input[name="start_date"]').fill('2026-04-27');
  await page.locator('input[name="pickup_address"]').fill('12 rue de Paris, Saint-Denis');
  await page.locator('input[name="dropoff_address"]').fill('CHU Felix Guyon');

  // Preview affiche au moins une ligne « jour férié »
  await expect(page.getByText(/jour férié 974/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Créer occurrences/i }).click();

  // Modal se ferme, retour sur la fiche patient
  await expect(page.getByText(/Lun\/Mer\/Ven 08h00/)).toBeVisible({ timeout: 10000 });
});
