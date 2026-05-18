# Plan-6 — Tests E2E offline + UAT informel iPhone + Android

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 6/7
**Dépendances**: Waves 1-5 toutes complètes
**Estimation**: 1h + 30 min UAT dirigeant (vélocité projetée 15-20 min code + 30 min UAT manuel)
**Refs**: VISION.md UAT informel obligatoire + audit UI consolidé pré-démo (PR #108), Option A cross-platform LOCKED

---

## Goal

Valider le scénario offline complet via Playwright + session UAT informel pré-démo sur 2 devices réels (iPhone + Android).

Si frictions remontées → CONCERNS.md + hotfix-bis si bloquantes.

---

## Fichiers à créer

- `apps/web/e2e/driver-offline-flow.spec.ts` — scénario offline complet
- `apps/web/e2e/pwa-install.spec.ts` — tests installabilité (best-effort)

## Fichiers à modifier

- aucun (tests s'ajoutent)

---

## `driver-offline-flow.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('chauffeur peut démarrer + clôturer course en offline et sync au retour', async ({ page, context }) => {
  // 1. Login chauffeur
  await page.goto('/login');
  await page.fill('input[name="email"]', 'chauffeur@demo.tap');
  await page.fill('input[name="password"]', 'demo1234!');
  await page.click('button[type="submit"]');

  // 2. Naviguer /conduite
  await page.waitForURL('/conduite');
  await expect(page.getByRole('heading', { name: /ma journée/i })).toBeVisible();

  // 3. Simuler offline
  await context.setOffline(true);

  // 4. Click « Démarrer course » → toast enregistrée
  await page.getByRole('button', { name: /démarrer/i }).first().click();
  await expect(page.getByText(/enregistrée, sync au retour/i)).toBeVisible({ timeout: 2000 });

  // 5. Vérifier mutations_queue contient 1 pending (via console eval Dexie)
  const pendingCountOffline = await page.evaluate(async () => {
    const dbModule = await import('/_next/static/chunks/dexie-instance.js' as any);
    return dbModule.db.mutations_queue.where('status').equals('pending').count();
  });
  expect(pendingCountOffline).toBe(1);

  // 6. ConnectionStatus affiche offline_with_queue + count=1
  await expect(page.getByRole('status', { name: /hors ligne.*1 mutation/i })).toBeVisible();

  // 7. Click « Terminer course » → 2 mutations pending
  await page.getByRole('button', { name: /terminer/i }).first().click();
  // ... formulaire end ride

  // 8. Simuler online
  await context.setOffline(false);

  // 9. Attendre flush automatique (online listener)
  await expect(page.getByRole('status', { name: /sync/i })).toBeVisible({ timeout: 3000 });

  // 10. Vérifier mutations_queue vide
  await page.waitForFunction(async () => {
    const dbModule = await import('/_next/static/chunks/dexie-instance.js' as any);
    return (await dbModule.db.mutations_queue.count()) === 0;
  }, { timeout: 10000 });

  // 11. Vérifier audit_logs Postgres : 2 INSERT cohérents (via Supabase admin client)
  //     → fait dans test séparé ou setup global avec service_role
});
```

## `pwa-install.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('PWA manifest + service worker + meta tags', async ({ page }) => {
  await page.goto('/conduite');

  // Manifest fetch
  const manifestRes = await page.request.get('/manifest.json');
  expect(manifestRes.status()).toBe(200);
  const manifest = await manifestRes.json();
  expect(manifest.start_url).toBe('/conduite');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('portrait');
  expect(manifest.icons).toHaveLength(4);

  // Service worker actif
  const swState = await page.evaluate(() => {
    return navigator.serviceWorker.controller?.state ?? null;
  });
  expect(swState).toBe('activated');

  // apple-touch-icon dans head
  const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]').count();
  expect(appleTouchIcon).toBeGreaterThan(0);

  // viewport-fit=cover
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
});
```

---

## UAT informel pré-démo (dirigeant, hors scope agent)

### Checklist iPhone (cible iPhone 13/14 ou SE)

- [ ] Visiter `https://tap-web-brown.vercel.app/conduite` (login chauffeur)
- [ ] Safari share sheet → « Ajouter à l'écran d'accueil »
- [ ] Icône home screen `apple-touch-icon` nette ?
- [ ] Tap icône → splash `apple-launch-*.png` s'affiche 1-2s ?
- [ ] Statusbar transparente avec contenu visible derrière ?
- [ ] Pas de Safari chrome (mode standalone) ?
- [ ] Mode avion → démarrer 1 course → toast « enregistrée » ?
- [ ] Désactiver mode avion → sync auto en < 10s ?

### Checklist Android (cible Samsung Galaxy A53 ou équivalent)

- [ ] Visiter `https://tap-web-brown.vercel.app/conduite` (login chauffeur)
- [ ] Chrome bottom sheet « Installer l'application » apparaît ?
- [ ] Install → icône maskable nette dans launcher ?
- [ ] Tap icône → splash auto-généré (background_color) ?
- [ ] Mode avion → démarrer 1 course → toast OK ?
- [ ] Désactiver mode avion → sync auto < 10s ?
- [ ] Bouton « Terminer » ≥ 56px (mesure DevTools mobile) ?
- [ ] ConnectionStatus 4 états cycle observable ?

**Total : 16 checks. Critère succès Wave 6 : 16/16 OK.**

Si friction observée → inscrire CONCERNS.md immédiatement + hotfix-bis si bloquante (pattern UAT informel obligatoire VISION.md PR #97).

---

## Critères GREEN Wave 6

- E2E `driver-offline-flow.spec.ts` passe (Playwright preview Vercel)
- E2E `pwa-install.spec.ts` passe (manifest + SW + meta tags)
- UAT informel dirigeant : 16/16 checks OK (8 iPhone + 8 Android)
- 0 friction critique remontée (sinon hotfix-bis Wave 6+)
- typecheck PASS, lint PASS

---

## Anti-patterns / NE PAS FAIRE

- ❌ Skip UAT cross-platform (Option A LOCKED PR #109 — iPhone ET Android obligatoires)
- ❌ Compter une session UAT < 15 min (minimum dirigeant 20-30 min sur 2 devices)
- ❌ Inscrire frictions verbales sans CONCERNS.md (pattern UAT informel VISION.md)
- ❌ Lancer Wave 7 captures avant 16/16 UAT GREEN
- ❌ E2E mock Dexie (utiliser vraie IndexedDB Playwright sinon false negative)
- ❌ Tests E2E sur localhost si preview Vercel disponible (canonical CI = preview cf CLAUDE.md § 13.5)
- ❌ Hotfix-bis pendant Wave 6 si non bloquant (inscrire CONCERNS, traiter Phase 04.9-bis si besoin)
