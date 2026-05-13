// =============================================================================
// E2E Playwright — Le régulateur gère les chauffeurs (hotfix Phase 04 DEC-029)
// =============================================================================
// Couvre le hotfix permissions chauffeurs (élargissement régulateur) :
//   - Layout (admin) autorise rôle régulateur sur /admin/chauffeurs
//   - Server Actions chauffeurs élargies via requireAdminOrRegulateur
//   - Nav (app) layout : entrée Chauffeurs visible pour le régulateur
//   - Archivage : modal confirmation renforcée (motif + saisie "ARCHIVER")
//
// Refs : hotfix permissions, DEC-029, requirement métier réel taxi
// conventionné 974.
// =============================================================================

import { test, expect } from '@playwright/test';

// Données fictives (NFR-001 — aucun nom propre réel)
const DRIVER_NAME = `Chauffeur regulateur ${Date.now()}`;
const ARCHIVE_MOTIF =
  'Test E2E hotfix permissions : régulateur peut archiver un chauffeur via modal de confirmation renforcée avec motif libre et saisie explicite.';

test.describe('Régulateur gère les chauffeurs end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    // Login régulateur démo via DemoCredentials card (flag preview activé)
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill('regulateur@demo.tap');
    await page.getByLabel('Mot de passe').fill('demo1234!');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    // Attendre redirect post-login (peut être /patients ou /courses par défaut)
    await page.waitForURL(/\/(patients|courses|admin)/);
  });

  test('régulateur accède à /admin/chauffeurs + CRUD + archive avec modal', async ({
    page,
  }) => {
    // 1. Visite /admin/chauffeurs (page accessible — pas de redirect /)
    await page.goto('/admin/chauffeurs');
    await expect(page).toHaveURL(/\/admin\/chauffeurs/);
    await expect(
      page.getByRole('heading', { name: /Chauffeurs|Gestion/i, level: 1 }),
    ).toBeVisible();

    // 2. Création d'un driver test
    await page.getByRole('button', { name: 'Nouveau chauffeur' }).click();
    await page.getByLabel('Nom affiché').fill(DRIVER_NAME);
    await page.getByLabel(/Taxi/i).check();
    await page.getByRole('button', { name: 'Créer le chauffeur' }).click();

    // 3. Assert création — la nouvelle ligne apparaît dans la liste
    await expect(page.getByText(DRIVER_NAME)).toBeVisible({ timeout: 10000 });

    // 4. Modification via Sheet édition — click sur la ligne
    await page.getByText(DRIVER_NAME).click();
    // Le Sheet d'édition s'ouvre avec le nom pré-rempli
    const newName = `${DRIVER_NAME} modifié`;
    const nameField = page.getByLabel('Nom affiché');
    await nameField.fill(newName);
    await page
      .getByRole('button', { name: /Enregistrer|Modifier/i })
      .first()
      .click();
    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });

    // 5. Tente d'archiver → ouverture modal confirmation renforcée
    await page.getByText(newName).click();
    await page.getByRole('button', { name: /Archiver/i }).first().click();

    // Le modal ArchiveDriverModal apparaît
    await expect(
      page.getByRole('dialog', { name: new RegExp(`Archiver.*${newName.slice(0, 20)}`) }),
    ).toBeVisible();

    // 6. Submit sans motif → erreur validation
    await page
      .getByRole('button', { name: 'Archiver définitivement' })
      .click({ trial: false, force: true })
      .catch(() => {
        // Le bouton peut être disabled (formState.isValid=false) — c'est OK
      });
    // Le formulaire n'a pas dû quitter le modal (bouton désactivé OU erreur affichée)
    await expect(
      page.getByRole('dialog', { name: /Archiver/ }),
    ).toBeVisible();

    // 7. Saisir motif > 10 chars + "ARCHIVER" + submit
    await page.getByLabel("Motif d'archivage").fill(ARCHIVE_MOTIF);
    await page
      .getByLabel('Confirmer en saisissant « ARCHIVER »')
      .fill('ARCHIVER');
    await page.getByRole('button', { name: 'Archiver définitivement' }).click();

    // 8. Assert toast success + driver disparaît de la liste (filtre archive=false par défaut)
    await expect(page.getByText(/archivé/i)).toBeVisible({ timeout: 10000 });
  });

  test('régulateur NE peut PAS accéder /admin/vehicules (sub-guard dirigeant)', async ({
    page,
  }) => {
    // Force URL vehicules → sub-guard requireDirigeantPage redirect /admin/chauffeurs
    await page.goto('/admin/vehicules');
    await page.waitForURL(/\/admin\/chauffeurs/);
    await expect(page).toHaveURL(/\/admin\/chauffeurs/);
  });

  test('régulateur voit le lien Chauffeurs dans la nav (app)', async ({
    page,
  }) => {
    // Navigation depuis le shell régulateur (app)
    await page.goto('/patients');
    // Lien Chauffeurs visible dans NavTabs
    const navLink = page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Chauffeurs' });
    await expect(navLink).toBeVisible();
    await navLink.click();
    await expect(page).toHaveURL(/\/admin\/chauffeurs/);
  });
});
