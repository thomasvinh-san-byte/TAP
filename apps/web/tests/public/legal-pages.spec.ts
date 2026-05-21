/**
 * E2E Playwright — Pages légales /legal/* publiques (DPA-07, D-13, D-21).
 *
 * Scénario : sans authentification, les pages /legal/cgu, /legal/cgv,
 * /legal/confidentialite, /legal/cookies, /legal/dpo répondent 200 sans
 * redirect vers /login. Le footer expose 5 liens vers ces pages.
 *
 * État RED Wave 0 : layout (public) + pages MDX n'existent pas encore (Wave 2).
 */
import { test, expect } from '@playwright/test';

const LEGAL_PAGES = [
  { slug: 'cgu', title: /conditions g[ée]n[ée]rales d.utilisation/i },
  { slug: 'cgv', title: /conditions g[ée]n[ée]rales de vente/i },
  {
    slug: 'confidentialite',
    title: /politique de confidentialit[ée]|confidentialit[ée]/i,
  },
  { slug: 'cookies', title: /cookies/i },
  { slug: 'dpo', title: /dpo|d[ée]l[ée]gu[ée] [àa] la protection/i },
] as const;

test.describe('pages publiques /legal/* sans auth', () => {
  for (const { slug, title } of LEGAL_PAGES) {
    test(`/legal/${slug} accessible sans login (200, pas de redirect)`, async ({ page }) => {
      const response = await page.goto(`/legal/${slug}`, {
        waitUntil: 'domcontentloaded',
      });
      expect(response?.status()).toBe(200);
      expect(page.url()).not.toContain('/login');
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    });
  }

  test('le footer expose 5 liens vers les pages /legal/*', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    for (const { slug } of LEGAL_PAGES) {
      await expect(footer.locator(`a[href="/legal/${slug}"]`)).toBeVisible();
    }
  });
});
