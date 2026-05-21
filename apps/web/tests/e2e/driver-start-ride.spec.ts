// =============================================================================
// E2E Playwright — Chauffeur démarre une course (hotfix DEC-033)
// =============================================================================
// Couvre le bug UAT : clic « Démarrer la course » → toast success mais le
// bouton restait « Démarrer la course » au lieu de passer à
// « Clôturer la course » à cause de `key={r.id}` stable au changement
// de `status` dans la liste rides côté chauffeur. Le fix DEC-033 ajoute
// `status` à la clé pour forcer le re-mount du composant client.
//
// Test V1 acceptablement non-idempotent (spec) : la course démo en statut
// `assignee` chez Vergoz Jean est consommée à chaque run. Au 2e run,
// aucune course assignée → le test skip avec un warning explicite.
// Dette test future : créer une course assignée fictive en setup, la
// supprimer en teardown.
//
// Refs : DEC-033, hotfix Bloc 2 UAT chauffeur.
// =============================================================================

import { test, expect } from '@playwright/test';

test('chauffeur peut démarrer une course assignée et voir le bouton passer à Clôturer', async ({
  page,
}) => {
  // Login chauffeur démo (Vergoz Jean — seul chauffeur affecté à une
  // course assignee J0 dans le seed DEC-031)
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('chauffeur@demo.tap');
  await page.getByLabel('Mot de passe').fill('demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/conduite/);

  await expect(page.getByRole('heading', { name: /journée|courses/i, level: 1 })).toBeVisible({
    timeout: 10000,
  });

  const startButtons = page.getByRole('button', { name: 'Démarrer la course' });
  const startButtonCount = await startButtons.count();

  if (startButtonCount === 0) {
    test.skip(
      true,
      'Aucune course assignée disponible (test non-idempotent V1 — DEC-031 seed consommé). Reset le seed via cd.yml ou execute_sql.',
    );
    return;
  }

  // Click le premier bouton « Démarrer la course »
  await startButtons.first().click();

  // Toast success affiché
  await expect(page.getByText('Course démarrée.')).toBeVisible({
    timeout: 5000,
  });

  // Cible du fix DEC-033 : après router.refresh(), la clé incluant `status`
  // force le re-mount → le bouton doit désormais être « Clôturer la course ».
  // Tolérance 10s pour la propagation revalidatePath + re-render.
  await expect(page.getByRole('button', { name: 'Clôturer la course' })).toBeVisible({
    timeout: 10000,
  });

  // Sanity : aucun bouton « Démarrer la course » sur la même course
  // (un autre ride assignee peut encore en exposer un, ce qui est OK).
  // On vérifie ici juste que la transition individuelle a fonctionné.
});
