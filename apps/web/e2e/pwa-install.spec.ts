/**
 * E2E Phase 04.9 Wave 6 — PWA installabilité.
 *
 * Vérifie les assets et meta tags nécessaires à l'installation PWA
 * cross-platform (Option A LOCKED PR #109) :
 *   - manifest.json valide avec shape attendue
 *   - apple-touch-icon présent (iOS Safari obligatoire)
 *   - viewport-fit=cover (notch handling)
 *   - apple-touch-startup-image 3 DPR
 *   - manifest link
 *   - Service worker registration (best-effort, disable en dev)
 *
 * Refs : PLAN-6, Wave 2 assets PWA (PR #113), 8 sources industrie 2026
 * UI-SPEC PR #110.
 */

import { test, expect } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

test.describe('PWA install assets', () => {
  test('manifest + meta tags présents', async ({ page }) => {
    // 1. Manifest fetch (pas besoin auth pour /manifest.json)
    const manifestRes = await page.request.get('/manifest.json');
    expect(manifestRes.status()).toBe(200);

    const manifest = (await manifestRes.json()) as {
      name: string;
      start_url: string;
      scope: string;
      display: string;
      orientation: string;
      icons: Array<{ src: string; sizes: string; purpose: string }>;
    };

    expect(manifest.start_url).toBe('/conduite');
    expect(manifest.scope).toBe('/conduite/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait'); // DEC-014 portrait-only
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    // Option A : maskable (Android) + any (iOS fallback + Android home)
    const hasMaskable = manifest.icons.some((i) =>
      i.purpose.includes('maskable'),
    );
    const hasAny = manifest.icons.some((i) => i.purpose.includes('any'));
    expect(hasMaskable).toBe(true);
    expect(hasAny).toBe(true);

    // 2. Login chauffeur puis naviguer /conduite pour valider meta tags head
    await loginAsRegulateur(page, 'chauffeur@demo.tap', 'demo1234!');
    await page.goto('/conduite');

    // 3. apple-touch-icon dans head (iOS Safari override manifest icons)
    const appleTouchIcon = await page
      .locator('link[rel="apple-touch-icon"]')
      .count();
    expect(appleTouchIcon).toBeGreaterThan(0);

    // 4. viewport-fit=cover (notch / Dynamic Island)
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewport).toContain('viewport-fit=cover');

    // 5. manifest link
    const manifestLink = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifestLink).toBe('/manifest.json');

    // 6. SW registration (acceptable 'no-sw' en dev car Serwist disable)
    const swState = await page.evaluate(() => {
      return navigator.serviceWorker.controller?.state ?? 'no-sw';
    });
    expect(['activated', 'no-sw']).toContain(swState);
  });

  test('apple-touch-startup-image links DPR-specific présents', async ({
    page,
  }) => {
    await loginAsRegulateur(page, 'chauffeur@demo.tap', 'demo1234!');
    await page.goto('/conduite');

    // 3 splash iOS DPR Option A cross-platform LOCKED
    const splashLinks = await page
      .locator('link[rel="apple-touch-startup-image"]')
      .count();
    expect(splashLinks).toBeGreaterThanOrEqual(3);
  });
});
