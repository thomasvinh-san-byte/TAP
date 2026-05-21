/**
 * E2E Playwright — Bandeau cookies CNIL-conforme (DPA-08, D-14).
 *
 * Scénarios :
 *   1. Sans auth, GET / → banner visible (non bloquant, en bas de page).
 *   2. Visual : les 3 boutons « Tout refuser », « Personnaliser », « Tout
 *      accepter » sont strictement équivalents — même hauteur (boundingBox)
 *      à ±2px et même classe Tailwind variant outline.
 *   3. Click « Tout refuser » → localStorage.cookieConsent.choices.analytics
 *      === false ET POST /api/legal/cookie-consent appelé.
 *
 * État RED Wave 0 : composant cookie-banner.client.tsx n'existe pas encore
 * (Wave 2). Anti-pattern CNIL Pitfall 4 : asymétrie sanctionnée.
 */
import { test, expect } from '@playwright/test';

test.describe('bandeau cookies — symétrie CNIL + persistance', () => {
  test('le bandeau apparaît sur la home sans authentification', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('dialog', { name: /pr[ée]f[ée]rences cookies/i });
    await expect(banner).toBeVisible();
  });

  test('les 3 boutons ont la même hauteur (±2px) et la même classe variant', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('dialog', { name: /pr[ée]f[ée]rences cookies/i });

    const refuser = banner.getByRole('button', { name: /tout refuser/i });
    const personnaliser = banner.getByRole('button', { name: /personnaliser/i });
    const accepter = banner.getByRole('button', { name: /tout accepter/i });

    const [boxR, boxP, boxA] = await Promise.all([
      refuser.boundingBox(),
      personnaliser.boundingBox(),
      accepter.boundingBox(),
    ]);

    expect(boxR).not.toBeNull();
    expect(boxP).not.toBeNull();
    expect(boxA).not.toBeNull();

    // Symétrie hauteur ±2px (Pitfall 4 RESEARCH — CNIL dark patterns)
    expect(Math.abs(boxR!.height - boxP!.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(boxP!.height - boxA!.height)).toBeLessThanOrEqual(2);

    // Symétrie classe variant (variant=outline pour les 3)
    const classR = await refuser.getAttribute('class');
    const classP = await personnaliser.getAttribute('class');
    const classA = await accepter.getAttribute('class');
    expect(classR).toContain('outline');
    expect(classP).toContain('outline');
    expect(classA).toContain('outline');
  });

  test("« Tout refuser » écrit dans localStorage.cookieConsent et POSTe l'API", async ({
    page,
  }) => {
    await page.goto('/');

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/api/legal/cookie-consent') && req.method() === 'POST',
      ),
      page.getByRole('button', { name: /tout refuser/i }).click(),
    ]);
    expect(request.method()).toBe('POST');

    const stored = await page.evaluate(() => localStorage.getItem('cookieConsent'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as {
      choices: { analytics: boolean; marketing: boolean };
    };
    expect(parsed.choices.analytics).toBe(false);
    expect(parsed.choices.marketing).toBe(false);
  });
});
