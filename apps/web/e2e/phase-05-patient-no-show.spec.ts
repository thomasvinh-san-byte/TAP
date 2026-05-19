import { expect, test } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

/**
 * Phase 05 Wave 6 — Workflow patient absent E2E (chauffeur → cockpit < 5s).
 *
 * Test SKIP par défaut V1.5 — pragmatic cohérent Phase 04.9 PR #115 :
 * nécessite un ride seedé status 'assignee' associé à un chauffeur démo
 * et à un patient avec téléphone. Le seed démo actuel ne garantit pas
 * cet état exact (les rides seedés peuvent être validee/non-assignee).
 *
 * Activable Phase 06 quand seed démo enrichi avec un ride 'assignee'
 * dédié au scénario no-show E2E. En attendant, le squelette ci-dessous
 * sert de référence pour activation future.
 *
 * Refs : PLAN-6 lignes 411-440, PLAN-7 lignes 89-156.
 */

test.describe.skip('Phase 05 — Workflow patient absent E2E', () => {
  test('chauffeur PWA déclare absent → cockpit alerte < 5s', async ({ browser }) => {
    const chauffeurContext = await browser.newContext();
    const regulateurContext = await browser.newContext();

    const chauffeurPage = await chauffeurContext.newPage();
    const regulateurPage = await regulateurContext.newPage();

    try {
      // 1. Régulatrice ouvre cockpit et reste sur la page (subscription Realtime active).
      await loginAsRegulateur(regulateurPage);
      await regulateurPage.goto('/cockpit');
      await regulateurPage.waitForLoadState('networkidle');

      // 2. Chauffeur login PWA + navigate /conduite.
      //    TODO Phase 06 : créer helper loginAsChauffeur (programmatique HTTP)
      //    similaire à loginAsRegulateur, basé sur seed `chauffeur1@tap.test`.

      // 3. Chauffeur ouvre une course assignée et déclare patient absent.
      //    await chauffeurPage.goto('/conduite');
      //    await chauffeurPage.getByRole('button', { name: /Patient absent/i }).click();
      //    await chauffeurPage.fill('textarea#no-show-motif', 'Patient ne répond pas');
      //    await chauffeurPage.getByRole('button', { name: /Confirmer absence/i }).click();

      // 4. Vérifier cockpit régulatrice : NoShowAlertModal apparaît < 5s
      //    via Realtime postgres_changes sur ride_events.
      await expect(
        regulateurPage.getByRole('alertdialog', { name: /Patient absent/i }),
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await chauffeurContext.close();
      await regulateurContext.close();
    }
  });
});
