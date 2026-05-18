# Plan-3 — Serwist scaffold + Dexie schema

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 3/7
**Dépendances**: aucune (parallèle W1 et W2)
**Estimation**: 2h (vélocité projetée 30-40 min réel)
**Refs**: DEC-019 LOCKED Serwist+Dexie 4.x, DEC-022 LOCKED storage.persist + warning 7j

---

## Goal

Initialiser le service worker offline cache (Serwist 9.x) + IndexedDB local (Dexie 4.x) avec schema `mutations_queue` + miroir `rides_mirror` + tracking `lastUsedAt` (DEC-022).

Phase 04.9 = scaffold + mutations offline. Le SYNC initial des données online (réplication) reste hors scope (Phase 06).

---

## Fichiers à créer

- `apps/web/src/lib/offline/dexie-schema.ts` — Dexie 4.x class avec tables
- `apps/web/src/lib/offline/dexie-instance.ts` — Singleton + helpers (openDb, wrappers)
- `apps/web/src/lib/offline/sw-register.client.ts` — Hook register SW + `storage.persist()` + lastUsedAt tracking
- `apps/web/src/sw.ts` — Serwist service worker entry point

## Fichiers à modifier

- `apps/web/next.config.mjs` — wrapper `withSerwistInit`
- `apps/web/package.json` — dépendances Serwist 9 + Dexie 4

---

## Dépendances à ajouter (`apps/web/package.json`)

```json
{
  "dependencies": {
    "serwist": "^9.0.0",
    "@serwist/next": "^9.0.0",
    "@serwist/precaching": "^9.0.0",
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.7"
  }
}
```

---

## Dexie schema `apps/web/src/lib/offline/dexie-schema.ts`

```ts
import Dexie, { type Table } from 'dexie';

export type MutationType = 'start_ride' | 'end_ride';
export type MutationStatus = 'pending' | 'in_flight' | 'failed' | 'dead';

export interface PendingMutation {
  id?: number;
  type: MutationType;
  resource_id: string;
  payload: unknown;
  idempotency_key: string;
  status: MutationStatus;
  attempts: number;
  created_at: Date;
  last_attempt_at: Date | null;
  last_error: string | null;
}

export interface RideMirror {
  id: string;
  status: string;
  pickup_address: string;
  pickup_at: string;
  patient_id: string | null;
  synced_at: Date;
}

export interface AppMeta {
  key: string;
  value: string | number | boolean;
}

export class DriverOfflineDb extends Dexie {
  mutations_queue!: Table<PendingMutation, number>;
  rides_mirror!: Table<RideMirror, string>;
  app_meta!: Table<AppMeta, string>;

  constructor() {
    super('tap-driver-offline');
    this.version(1).stores({
      mutations_queue: '++id, status, type, resource_id, created_at',
      rides_mirror: 'id, status, pickup_at, synced_at',
      app_meta: 'key',
    });
  }
}
```

---

## Service worker `apps/web/src/sw.ts`

```ts
import { defaultCache } from '@serwist/next/worker';
import { type PrecacheEntry, type SerwistGlobalConfig, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // /api/driver/* → NetworkOnly (mutations ne doivent JAMAIS être cachées)
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/driver/'),
      handler: new (await import('serwist')).NetworkOnly(),
    },
    // /conduite/* → NetworkFirst avec fallback cache
    ...defaultCache,
  ],
});

serwist.addEventListeners();
```

---

## `apps/web/next.config.mjs`

```js
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  // ... config existante
};

export default withSerwist(nextConfig);
```

---

## Hook register `apps/web/src/lib/offline/sw-register.client.ts`

```ts
'use client';

import { useEffect } from 'react';
import { db } from './dexie-instance';

const LAST_USED_KEY = 'lastUsedAt';

export function useServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register SW
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('SW registration failed', e);
    });

    // navigator.storage.persist() — DEC-022 mitigation iOS purge IndexedDB
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage.persist().then((persisted) => {
        console.info('Storage persisted:', persisted);
      });
    }

    // Tracking lastUsedAt — Wave 5 lit cette valeur pour WarningBanner > 7j
    db.app_meta.put({ key: LAST_USED_KEY, value: Date.now() });
  }, []);
}
```

---

## Note Phase 04.9 vs Phase 06

Le miroir `rides_mirror` permet au chauffeur de voir SA journée même offline. Mais le SYNC initial (réplication serveur → IndexedDB au mount online) est **hors scope Phase 04.9** — c'est Phase 06 PWA full offline.

Phase 04.9 = mutations offline + sync au retour. Read-only offline = ce qui était déjà chargé en RSC avant offline. `rides_mirror` est un cache opportuniste, pas un système de réplication.

---

## Critères GREEN Wave 3

- Service worker enregistré (Chrome DevTools Application → Service Workers status « activated »)
- Dexie database créée (Chrome DevTools Application → IndexedDB → `tap-driver-offline` avec 3 tables)
- `navigator.storage.persist()` retourne `true` sur iOS PWA installée (sinon `false` browser tab — normal)
- `app_meta.lastUsedAt` écrit au mount (lecture/écriture testable via console)
- `/sw.js` servi en prod (curl `/sw.js` retourne JS valide)
- typecheck PASS, lint PASS

---

## Anti-patterns / NE PAS FAIRE

- ❌ Cacher `/api/driver/*` (mutations JAMAIS cachées, NetworkOnly strict)
- ❌ `disable: false` en development (Serwist en dev casse HMR)
- ❌ Dexie schema sans version (migrations futures impossibles)
- ❌ `reloadOnOnline: true` (force-reload pendant qu'un chauffeur tape une mutation = perte saisie)
- ❌ Skip `storage.persist()` (iOS purge garantie ~2sem, DEC-022 mitigation obligatoire)
- ❌ Skipper l'enregistrement SW si dev (toujours register, le `disable` flag Serwist gère)
- ❌ Coupler register SW à un composant client précis (toujours dans layout root pour mount universel `/conduite`)
