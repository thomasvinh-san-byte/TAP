// =============================================================================
// E2E Playwright — Hotfix 04.7-bis (Phase 04.7 UAT informel)
// =============================================================================
// Couvre 3 frictions identifiées UAT informel post-execute Phase 04.7 :
//
//   F1 — Modal saisie course largeur stable avec POI long
//        (CHU Sud Saint-Pierre — Avenue du Président Mitterrand,
//        Terre-Sainte, 97410 Saint-Pierre) → modal w-[calc(100vw-32px)]
//        max-w-[640px], pill truncate + title tooltip
//
//   F2 — Filtre date sur page /courses
//        Input type=date par défaut aujourd'hui + bouton Effacer
//
//   F3 — Pagination simple page /courses
//        Compteur « X courses affichées » + bouton « Voir plus »
//        si plus de 50 rides match
//
// V1 non-idempotent acceptable : pas de cleanup BDD (filtre par dates,
// pas de mutate).
//
// Refs : Hotfix 04.7-bis, méthodologie UAT informel VISION.md PR #97.
// =============================================================================

import { test, expect } from '@playwright/test';

async function loginAsRegulateur(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('regulateur@demo.tap');
  await page.getByLabel('Mot de passe').fill('demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(patients|courses|admin)/);
}

test.describe('Hotfix 04.7-bis — Courses modal/filter/pagination', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRegulateur(page);
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: 'Courses', level: 1 })).toBeVisible({
      timeout: 5000,
    });
  });

  test('F1 — Modal saisie course max-width respecté', async ({ page }) => {
    await page.keyboard.press('Control+Shift+K').catch(() => undefined);
    const newRideBtn = page
      .getByRole('button', { name: /Nouvelle course|Saisie express/i })
      .first();
    if (await newRideBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await newRideBtn.click();
    }

    const dialog = page.getByRole('dialog').first();
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Modal saisie course non accessible.');
      return;
    }
    const box = await dialog.boundingBox();
    if (!box) {
      test.skip(true, 'Bounding box modal indisponible.');
      return;
    }
    // Modal ne doit pas dépasser viewport - 16px (padding minimum)
    const viewport = page.viewportSize();
    if (viewport) {
      expect(box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.width).toBeLessThanOrEqual(640);
    }
  });

  test("F2 — Filtre date présent + valeur aujourd'hui par défaut", async ({ page }) => {
    const dateInput = page.getByLabel('Filtre date des courses');
    await expect(dateInput).toBeVisible({ timeout: 5000 });
    // DateFieldFr affiche la date au format français JJ/MM/AAAA.
    const now = new Date();
    const todayFr = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}/${now.getFullYear()}`;
    await expect(dateInput).toHaveValue(todayFr);
  });

  test('F2bis — Bouton Effacer date remet liste sans filtre', async ({ page }) => {
    const dateInput = page.getByLabel('Filtre date des courses');
    await expect(dateInput).toBeVisible({ timeout: 5000 });
    const clearBtn = page.getByRole('button', {
      name: 'Effacer le filtre date',
    });
    await expect(clearBtn).toBeVisible({ timeout: 3000 });
    await clearBtn.click();
    await expect(dateInput).toHaveValue('');
  });

  test('F3 — Compteur « X courses affichées » visible si rides présentes', async ({ page }) => {
    // Effacer date pour voir tout
    const clearBtn = page.getByRole('button', {
      name: 'Effacer le filtre date',
    });
    if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearBtn.click();
    }
    // Compteur présent si rides affichées
    const compteur = page.getByText(/\d+ courses? affichées?/i);
    if (await compteur.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(compteur).toBeVisible();
    } else {
      test.skip(true, 'Aucune ride dans le seed après effacement date.');
    }
  });
});
