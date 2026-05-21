// =============================================================================
// E2E Playwright — Workflow chauffeur complet (PLAN-1 T1.3 Phase 04.5)
// =============================================================================
// Couvre le golden path chauffeur de bout en bout :
//   1. Login chauffeur démo (Vergoz Jean)
//   2. /conduite affiche au moins une course assignée
//   3. Démarrer la course → toast success + bouton « Clôturer la course »
//   4. Cliquer « Clôturer la course » → modal de clôture
//   5. Saisir tarif + valider en mode cash + encaissé maintenant (défauts)
//   6. Statut de la course passe à « Terminée »
//
// V1 acceptablement non-idempotent (PLAN-1 T1.3) : le seed démo DEC-031
// fournit une course assignée à Vergoz Jean qui est consommée par le test.
// Si la course est déjà démarrée ou terminée (run précédent), le test
// skip proprement avec message explicite. La réinjection vient du
// seed.demo.sql glissant DEC-039 au prochain reseed CD.
//
// Refs : PLAN-1 T1.3, DEC-039, DEC-041 (row count check post T1.4).
// Diff vs driver-start-ride.spec.ts : ce test va jusqu'à la clôture
// complète (paiement + statut terminee), pas seulement la transition
// démarrer → clôturer.
// =============================================================================

import { test, expect } from '@playwright/test';

test.describe('Driver workflow E2E complet', () => {
  test('chauffeur peut démarrer et clôturer une course de bout en bout', async ({ page }) => {
    // 1. Login chauffeur démo
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill('chauffeur@demo.tap');
    await page.getByLabel('Mot de passe').fill('demo1234!');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL(/\/conduite/);

    await expect(page.getByRole('heading', { name: /journée|courses/i, level: 1 })).toBeVisible({
      timeout: 10000,
    });

    // 2. Démarrer la première course assignée disponible
    const startButtons = page.getByRole('button', {
      name: 'Démarrer la course',
    });
    const startCount = await startButtons.count();

    if (startCount === 0) {
      // Fallback : peut-être qu'une course est déjà en_cours (run précédent
      // partiellement consommé). On tente la clôture directement.
      const closeButtons = page.getByRole('button', {
        name: 'Clôturer la course',
      });
      const closeCount = await closeButtons.count();
      if (closeCount === 0) {
        test.skip(
          true,
          'Aucune course assignée ni en_cours pour Vergoz (seed démo consommé). Reseed via cd.yml requis.',
        );
        return;
      }
      // Sinon on passe direct à l'étape 4 ci-dessous (skipping étape 2-3).
    } else {
      await startButtons.first().click();

      // 3. Toast success + bouton bascule à « Clôturer la course »
      await expect(page.getByText('Course démarrée.')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByRole('button', { name: 'Clôturer la course' }).first()).toBeVisible({
        timeout: 10000,
      });
    }

    // 4. Ouvrir le modal de clôture (premier bouton « Clôturer la course »
    // de la liste — celui de la course qu'on vient de démarrer)
    await page.getByRole('button', { name: 'Clôturer la course' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('heading', { name: 'Clôturer la course' })).toBeVisible();

    // 5. Saisir tarif (défauts modal : cash + encaissé maintenant)
    await dialog.getByLabel('Tarif en euros').fill('25');

    // Bouton submit (dans le dialog, distinct du trigger de la liste)
    await dialog.getByRole('button', { name: 'Clôturer la course' }).click();

    // Toast success clôture
    await expect(page.getByText('Course clôturée.')).toBeVisible({
      timeout: 5000,
    });

    // 6. Statut « Terminée » visible (badge h-14 ou texte « Terminée à HHhMM »)
    await expect(page.getByText(/Terminée( à \d+h\d+)?/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
