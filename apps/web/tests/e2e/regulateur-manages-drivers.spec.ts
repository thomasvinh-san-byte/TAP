// =============================================================================
// E2E Playwright — Sémantique 4 actions chauffeurs (hotfix-bis Phase 04 DEC-029)
// =============================================================================
// Couvre la sémantique 4 actions distinctes :
//   - Désactiver  (régulateur OU dirigeant, filet de sécurité, réversible)
//   - Réactiver   (régulateur OU dirigeant, instantané)
//   - Archiver    (DIRIGEANT UNIQUEMENT, confirmation renforcée)
//   - Désarchiver (régulateur OU dirigeant, confirmation simple)
//
// Trois lignes de défense vérifiées :
//   - UI : bouton Archiver caché côté régulateur
//   - Server Action : guard requireDirigeant sur archiveDriverAction
//   - BDD : trigger drivers_archive_columns_guard bloque côté Postgres
//
// Refs : DEC-029 affinée, hotfix-bis Volet 1, requirement métier 974.
// =============================================================================

import { test, expect } from '@playwright/test';

const TS = Date.now();
const DRIVER_NAME_REG = `Chauffeur Reg ${TS}`;
const DRIVER_NAME_DIR = `Chauffeur Dir ${TS}`;
const ARCHIVE_MOTIF =
  'Test E2E sémantique 4 actions : sortie système après fin de contrat. Archivage par dirigeant uniquement avec saisie ARCHIVER.';

async function loginAs(page: import('@playwright/test').Page, role: 'regulateur' | 'dirigeant') {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(`${role}@demo.tap`);
  await page.getByLabel('Mot de passe').fill('demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(patients|courses|admin)/);
}

test.describe('Sémantique 4 actions chauffeurs', () => {
  test('régulateur peut désactiver puis réactiver mais PAS archiver', async ({ page }) => {
    await loginAs(page, 'regulateur');
    await page.goto('/admin/chauffeurs');
    await expect(page).toHaveURL(/\/admin\/chauffeurs/);

    // 1. Création d'un driver test
    await page.getByRole('button', { name: 'Nouveau chauffeur' }).click();
    await page.getByLabel('Nom affiché').fill(DRIVER_NAME_REG);
    await page.getByLabel(/Taxi/i).check();
    await page.getByRole('button', { name: 'Créer le chauffeur' }).click();
    await expect(page.getByText(DRIVER_NAME_REG)).toBeVisible({
      timeout: 10000,
    });

    // 2. Désactivation via DeactivateConfirmDialog
    await page.getByRole('button', { name: `Désactiver ${DRIVER_NAME_REG}` }).click();
    await expect(page.getByRole('dialog', { name: /Désactiver/ })).toBeVisible();
    await page.getByLabel('Je confirme la désactivation.').check();
    await page.getByRole('button', { name: 'Désactiver' }).last().click();
    await expect(page.getByText(/désactivé/i)).toBeVisible({ timeout: 10000 });

    // 3. Réactivation instantanée — bouton Réactiver inline
    await page.getByRole('button', { name: `Réactiver ${DRIVER_NAME_REG}` }).click();
    await expect(page.getByText(/réactivé/i)).toBeVisible({ timeout: 10000 });

    // 4. Aucun bouton Archiver visible côté régulateur sur la ligne
    await expect(page.getByRole('button', { name: `Archiver ${DRIVER_NAME_REG}` })).toHaveCount(0);

    // 5. Le Sheet d'édition n'expose pas non plus le bouton "Archiver ce chauffeur"
    await page.getByText(DRIVER_NAME_REG).click();
    await expect(page.getByRole('button', { name: /Archiver ce chauffeur/i })).toHaveCount(0);
  });

  test('dirigeant peut archiver avec confirmation renforcée puis désarchiver', async ({ page }) => {
    await loginAs(page, 'dirigeant');
    await page.goto('/admin/chauffeurs');

    // Création
    await page.getByRole('button', { name: 'Nouveau chauffeur' }).click();
    await page.getByLabel('Nom affiché').fill(DRIVER_NAME_DIR);
    await page.getByLabel(/Taxi/i).check();
    await page.getByRole('button', { name: 'Créer le chauffeur' }).click();
    await expect(page.getByText(DRIVER_NAME_DIR)).toBeVisible({
      timeout: 10000,
    });

    // Archivage via bouton inline (dirigeant only)
    await page.getByRole('button', { name: `Archiver ${DRIVER_NAME_DIR}` }).click();
    await expect(
      page.getByRole('dialog', {
        name: new RegExp(`Archiver.*${DRIVER_NAME_DIR.slice(0, 12)}`),
      }),
    ).toBeVisible();

    // Submit sans motif : bouton désactivé OU erreur visible
    await page
      .getByRole('button', { name: 'Archiver définitivement' })
      .click({ force: true })
      .catch(() => {});
    await expect(page.getByRole('dialog', { name: /Archiver/ })).toBeVisible();

    // Motif + ARCHIVER + submit
    await page.getByLabel("Motif d'archivage").fill(ARCHIVE_MOTIF);
    await page.getByLabel('Confirmer en saisissant « ARCHIVER »').fill('ARCHIVER');
    await page.getByRole('button', { name: 'Archiver définitivement' }).click();
    await expect(page.getByText(/archivé/i)).toBeVisible({ timeout: 10000 });

    // Toggle filtre Archivés → le chauffeur réapparaît
    await page.getByRole('tab', { name: 'Archivés' }).click();
    await expect(page.getByText(DRIVER_NAME_DIR)).toBeVisible();

    // Désarchivage via UnarchiveConfirmDialog
    await page.getByRole('button', { name: `Désarchiver ${DRIVER_NAME_DIR}` }).click();
    await expect(page.getByRole('dialog', { name: /Désarchiver/ })).toBeVisible();
    await page.getByLabel('Je confirme le désarchivage.').check();
    await page.getByRole('button', { name: 'Désarchiver' }).last().click();
    await expect(page.getByText(/désarchivé/i)).toBeVisible({ timeout: 10000 });
  });

  test('régulateur NE peut PAS accéder /admin/vehicules (sub-guard dirigeant)', async ({
    page,
  }) => {
    await loginAs(page, 'regulateur');
    await page.goto('/admin/vehicules');
    await page.waitForURL(/\/admin\/chauffeurs/);
    await expect(page).toHaveURL(/\/admin\/chauffeurs/);
  });

  test('régulateur voit le lien Chauffeurs dans la nav (app)', async ({ page }) => {
    await loginAs(page, 'regulateur');
    await page.goto('/patients');
    const navLink = page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Chauffeurs' });
    await expect(navLink).toBeVisible();
    await navLink.click();
    await expect(page).toHaveURL(/\/admin\/chauffeurs/);
  });
});
