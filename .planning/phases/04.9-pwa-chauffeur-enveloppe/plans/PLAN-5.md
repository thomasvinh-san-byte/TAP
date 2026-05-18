# Plan-5 — UI composants (ConnectionStatus + WarningBanner + DriverShell)

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 5/7
**Dépendances**: Wave 2 (manifest theme_color) + Wave 3 (Dexie schema pour useLiveQuery)
**Estimation**: 1.5h (vélocité projetée 25-30 min réel)
**Refs**: UI-SPEC PR #110 (3 composants spec'd), DEC-014 56px touch targets, DEC-022 warning 7j

---

## Goal

Implémenter les 3 composants spec'd UI-SPEC :
1. `ConnectionStatusBadge` (4 états intégrés header, sans banner full-width)
2. `WarningBannerInactivity` (DEC-022 > 7j IndexedDB)
3. `DriverShell` extensions safe-area iOS notch

---

## Fichiers à créer

- `apps/web/src/app/(driver)/_components/connection-status-badge.client.tsx`
- `apps/web/src/app/(driver)/_components/warning-banner-inactivity.client.tsx`
- `apps/web/src/app/(driver)/_lib/use-is-standalone.ts`

## Fichiers à modifier

- `apps/web/src/app/(driver)/layout.tsx` — safe-area padding + intégration badge + banner
- `apps/web/src/app/globals.css` — utilities `.pt-safe` / `.pb-safe` / `.pl-safe` / `.pr-safe`

---

## `ConnectionStatusBadge` — 4 états

```tsx
'use client';

import { CloudOff, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '@/lib/offline/use-sync-status';
import { cn } from '@/lib/utils';

export function ConnectionStatusBadge() {
  const { isOnline, pendingCount, isSynching } = useSyncStatus();

  // online_idle : RIEN visible (header normal, pas de pollution UI)
  if (isOnline && pendingCount === 0) return null;

  // synching : badge primary pulse + RefreshCw rotating
  if (isSynching) {
    return (
      <div
        role="status"
        aria-label={`Synchronisation en cours, ${pendingCount} mutations`}
        className="inline-flex items-center gap-8 rounded-full bg-primary/10 px-12 py-4 text-sm text-primary animate-pulse"
      >
        <RefreshCw aria-hidden className="h-16 w-16 animate-spin" />
        <span>Sync… {pendingCount}</span>
      </div>
    );
  }

  // offline_with_queue : warning clignotant + CloudOff + count
  if (!isOnline && pendingCount > 0) {
    return (
      <div
        role="status"
        aria-label={`Hors ligne, ${pendingCount} mutations en attente`}
        className="inline-flex items-center gap-8 rounded-full bg-amber-100 px-12 py-4 text-sm text-amber-900 animate-pulse"
      >
        <CloudOff aria-hidden className="h-16 w-16" />
        <span>Hors-ligne · {pendingCount}</span>
      </div>
    );
  }

  // offline_idle : muted gris stable
  return (
    <div
      role="status"
      aria-label="Hors ligne"
      className="inline-flex items-center gap-8 rounded-full bg-muted px-12 py-4 text-sm text-muted-foreground"
    >
      <CloudOff aria-hidden className="h-16 w-16" />
      <span>Hors-ligne</span>
    </div>
  );
}
```

---

## `WarningBannerInactivity` — > 7j IndexedDB

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { db } from '@/lib/offline/dexie-instance';
import { Button } from '@/components/ui/button';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
const LAST_USED_KEY = 'lastUsedAt';
const DISMISSED_KEY = 'warningInactivityDismissed';

export function WarningBannerInactivity() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      const lastUsed = await db.app_meta.get(LAST_USED_KEY);
      const dismissed = await db.app_meta.get(DISMISSED_KEY);
      if (!lastUsed) return; // fresh start, pas de warning

      const lastMs = Number(lastUsed.value);
      const now = Date.now();
      if (now - lastMs > SEVEN_DAYS_MS && !dismissed?.value) {
        setShow(true);
      }
    })();
  }, []);

  const dismiss = async () => {
    await db.app_meta.put({ key: DISMISSED_KEY, value: true });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="alert"
      className="mb-16 flex items-start gap-12 rounded-md border border-amber-200 bg-amber-50 p-12 text-amber-900"
    >
      <AlertTriangle aria-hidden className="h-20 w-20 shrink-0 mt-2" />
      <div className="flex-1 text-sm">
        Bienvenue. Si tu as un problème de chargement, ferme et relance l'app.
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={dismiss}
        className="h-56 shrink-0"
        aria-label="Compris, masquer cet avertissement"
      >
        Compris
      </Button>
    </div>
  );
}
```

---

## `use-is-standalone.ts`

```ts
'use client';

import { useEffect, useState } from 'react';

export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const android = window.matchMedia('(display-mode: standalone)').matches;
    const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(android || ios);
  }, []);

  return isStandalone;
}
```

---

## Modifications `apps/web/src/app/(driver)/layout.tsx`

```tsx
// 1. Header : padding-top safe-area iOS notch
<header className="pt-safe sticky top-0 z-10 ...">
  <div className="flex items-center justify-between px-16">
    <span className="font-semibold">TAP</span>
    <div className="flex items-center gap-12">
      <ConnectionStatusBadge />
      <UserMenu />
    </div>
  </div>
</header>

// 2. Main : padding-bottom safe-area iOS home indicator
<main className="pb-safe ...">
  <WarningBannerInactivity />
  {children}
</main>
```

---

## Modifications `apps/web/src/app/globals.css`

```css
@layer utilities {
  .pt-safe { padding-top: env(safe-area-inset-top); }
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
  .pl-safe { padding-left: env(safe-area-inset-left); }
  .pr-safe { padding-right: env(safe-area-inset-right); }

  .mt-safe { margin-top: env(safe-area-inset-top); }
  .mb-safe { margin-bottom: env(safe-area-inset-bottom); }
}
```

Alternative au plugin `tailwindcss-safe-area` (zero-dep, native env() Tailwind 3.x via @layer utilities).

---

## Touch targets (DEC-014 LOCKED)

- `ConnectionStatusBadge` : conteneur 32px hauteur (acceptable car indicateur status, pas action)
- `WarningBanner` bouton « Compris » : `h-56` (DEC-014 driver primary touch)
- Espacement badges header : `gap-12` (12px Material recommandation)

---

## Critères GREEN Wave 5

- 4 états ConnectionStatus rendus correctement (test visuel manuel + Wave 6 E2E)
- WarningBanner s'affiche après > 7j inactivité simulée (édit Dexie manuellement `lastUsedAt = Date.now() - 8 * 24 * 3600 * 1000`)
- Safe-area paddings appliqués (iPhone 14+ Safari preview Chrome DevTools)
- `useIsStandalone()` retourne `true` en mode PWA installée (test Wave 6 device réel)
- Touch targets > 48px audit Chrome DevTools Accessibility (badge passable, bouton Compris OK 56px)
- Anti-pattern check : ConnectionStatus PAS de banner full-width (intégré au header)
- typecheck PASS, lint PASS

---

## Anti-patterns / NE PAS FAIRE

- ❌ Banner full-width ConnectionStatus (UI-SPEC PR #110 anti-pattern explicite)
- ❌ Modal bloquante WarningBannerInactivity (chauffeur veut voir ses courses)
- ❌ Texte « offline » seul sans icône CloudOff (illettrisme défense Material Design)
- ❌ Couleur destructive (rouge) sur ConnectionStatus (réservé dead letter toast Wave 4)
- ❌ Re-render full header à chaque tick Dexie (le composant `ConnectionStatusBadge` est isolé)
- ❌ Polling `navigator.onLine` (events réactifs `online`/`offline` uniquement)
- ❌ Touch targets < 48px sur bouton « Compris » (DEC-014 LOCKED ≥56px)
- ❌ Modifier le header existant ailleurs (intégration ciblée uniquement)
