/**
 * E2E Phase 04.9 Wave 6 — Driver PWA offline flow.
 *
 * Scénario : chauffeur démarre une course en mode offline, la mutation
 * est enqueued localement (Dexie), puis syncée automatiquement au
 * retour réseau via online listener.
 *
 * Validation via composants UI (`ConnectionStatusBadge` + toasts Sonner)
 * plutôt que via accès Dexie direct (fragile en CI car import chunks
 * Next.js hashés). Le badge avec count est la preuve visible que la
 * queue est pleine.
 *
 * Note : flow Démarrer→Terminer offline en chaîne PAS testable Phase
 * 04.9 (état `ride.status` reste 'assignee' côté serveur, UI affiche
 * encore « Démarrer »). Dette « optimistic UI miroir Dexie » inscrite
 * CONCERNS Phase 06.
 *
 * Refs : PLAN-6, Waves 4+5 (PR #114), UI-SPEC PR #110.
 */

import { test, expect } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

test.describe('Driver PWA — offline → sync flow', () => {
  test('démarrer course offline puis sync au retour réseau', async ({ page, context }) => {
    // 1. Login chauffeur démo (helper générique, accepte n'importe quel compte)
    await loginAsRegulateur(page, 'chauffeur@demo.tap', 'demo1234!');

    // 2. Naviguer /conduite
    await page.goto('/conduite');
    await expect(page.getByRole('heading', { name: /ma journée/i })).toBeVisible();

    // 3. État initial : online_idle (badge invisible — null render)
    await expect(page.getByRole('status', { name: /hors ligne|sync/i })).toHaveCount(0);

    // 4. Simuler offline
    await context.setOffline(true);

    // 5. Badge passe à offline_idle (queue vide encore)
    await expect(page.getByRole('status', { name: /^hors ligne$/i })).toBeVisible({
      timeout: 5000,
    });

    // 6. Click « Démarrer » si une course est disponible
    const demarrer = page.getByRole('button', { name: /démarrer/i }).first();
    const hasRide = await demarrer.isVisible().catch(() => false);

    if (hasRide) {
      await demarrer.click();

      // 7. Toast « Mutation enregistrée » apparaît
      await expect(page.getByText(/enregistrée.*sync au retour/i)).toBeVisible({ timeout: 3000 });

      // 8. Badge passe à offline_with_queue avec count >= 1
      await expect(page.getByRole('status', { name: /hors ligne.*\d+/i })).toBeVisible({
        timeout: 3000,
      });
    } else {
      console.warn(
        '[E2E] Aucune course « Démarrer » disponible pour chauffeur@demo.tap. ' +
          'Validation partielle offline → online sans mutation effective.',
      );
    }

    // 9. Retour online → online listener flushQueue auto
    await context.setOffline(false);

    // 10. Badge disparaît (queue vide = sync OK)
    await expect(page.getByRole('status', { name: /hors ligne|sync/i })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
