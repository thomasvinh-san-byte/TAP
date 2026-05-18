# Plan-4 — Sync engine (queue + retry + dead letter)

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 4/7
**Dépendances**: Wave 1 (Route Handlers) + Wave 3 (Dexie schema)
**Estimation**: 2h (vélocité projetée 30-40 min réel)
**Refs**: DEC-045 Route Handlers, DEC-019 Dexie 4.x, UI-SPEC PR #110 anti-patterns

---

## Goal

Implémenter le sync engine qui flush la queue Dexie `mutations_queue` vers les Route Handlers Wave 1 avec retry exponentiel + dead letter + idempotency UUID v4 client-generated.

Background Sync API non supporté iOS → fallback `window.addEventListener('online')`.

---

## Fichiers à créer

- `apps/web/src/lib/offline/sync-engine.ts` — `enqueue`, `flushQueue`
- `apps/web/src/lib/offline/use-sync-status.ts` — Hook React combinant Dexie `useLiveQuery` + `navigator.onLine`
- `apps/web/src/lib/offline/network-listener.client.ts` — Hook attache listener `online` au mount
- `apps/web/src/lib/offline/types.ts` — Types PendingMutation, MutationStatus, SyncResult (peut être dans dexie-schema.ts Wave 3)

## Fichiers à modifier

- `apps/web/src/app/(driver)/conduite/_components/ride-actions.client.tsx` — wrapper online/offline avec enqueue fallback

---

## `sync-engine.ts`

```ts
import { db } from './dexie-instance';
import { toast } from 'sonner';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;
const JITTER_MS = 500;
const MAX_DELAY_MS = 30000;

function jitter(base: number): number {
  return base + (Math.random() * 2 - 1) * JITTER_MS;
}

function delayForAttempt(attempts: number): number {
  return Math.min(jitter(BASE_DELAY_MS * Math.pow(2, attempts - 1)), MAX_DELAY_MS);
}

export async function enqueue(input: {
  type: 'start_ride' | 'end_ride';
  resource_id: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.mutations_queue.add({
    type: input.type,
    resource_id: input.resource_id,
    payload: input.payload,
    idempotency_key: crypto.randomUUID(),
    status: 'pending',
    attempts: 0,
    created_at: new Date(),
    last_attempt_at: null,
    last_error: null,
  });
}

export async function flushQueue(): Promise<{
  flushed: number; failed: number; dead: number;
}> {
  const pending = await db.mutations_queue
    .where('status').anyOf('pending', 'failed')
    .sortBy('created_at');

  let flushed = 0, failed = 0, dead = 0;

  for (const m of pending) {
    if (m.attempts >= MAX_ATTEMPTS) continue;

    await db.mutations_queue.update(m.id!, {
      status: 'in_flight',
      last_attempt_at: new Date(),
    });

    try {
      const endpoint = `/api/driver/rides/${m.resource_id}/${m.type === 'start_ride' ? 'start' : 'end'}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: m.idempotency_key, ...(m.payload as object) }),
      });

      if (res.ok) {
        await db.mutations_queue.delete(m.id!);
        flushed++;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      const newAttempts = m.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? 'dead' : 'failed';

      await db.mutations_queue.update(m.id!, {
        status: newStatus,
        attempts: newAttempts,
        last_error: err instanceof Error ? err.message : String(err),
      });

      if (newStatus === 'dead') {
        dead++;
        toast.error('Synchronisation échouée', {
          description: 'Re-tenter manuellement ou contacter le régulateur.',
        });
      } else {
        failed++;
        await new Promise((r) => setTimeout(r, delayForAttempt(newAttempts)));
      }
    }
  }

  return { flushed, failed, dead };
}
```

---

## `use-sync-status.ts`

```ts
'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './dexie-instance';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const pendingCount = useLiveQuery(
    () => db.mutations_queue.where('status').anyOf('pending', 'in_flight', 'failed').count(),
    [],
    0,
  );

  const deadCount = useLiveQuery(
    () => db.mutations_queue.where('status').equals('dead').count(),
    [],
    0,
  );

  return {
    isOnline,
    pendingCount: pendingCount ?? 0,
    deadCount: deadCount ?? 0,
    isSynching: isOnline && (pendingCount ?? 0) > 0,
  };
}
```

---

## `network-listener.client.ts`

```ts
'use client';

import { useEffect } from 'react';
import { flushQueue } from './sync-engine';

export function useNetworkListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      void flushQueue();
    };

    window.addEventListener('online', handler);

    // Premier flush au mount si online (cas reload PWA après offline)
    if (navigator.onLine) {
      void flushQueue();
    }

    return () => window.removeEventListener('online', handler);
  }, []);
}
```

---

## Modification `ride-actions.client.tsx`

Pattern wrapper online/offline :

```ts
async function handleStartRide(rideId: string) {
  try {
    if (navigator.onLine) {
      const idempotency_key = crypto.randomUUID();
      const res = await fetch(`/api/driver/rides/${rideId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Course démarrée');
    } else {
      throw new Error('offline');
    }
  } catch {
    await enqueue({ type: 'start_ride', resource_id: rideId, payload: {} });
    toast.warning('Mutation enregistrée, sync au retour réseau');
  }
}
```

---

## Retry strategy détaillée

| Attempt | Délai avant retry | Total cumul |
|---------|-------------------|-------------|
| 1 | immédiat | 0s |
| 2 | 2s + jitter ±500ms | ~2s |
| 3 | 4s + jitter ±500ms | ~6s |
| Échec final | → status=`dead` + toast Sonner destructive | ~6s |

Max 30s cap entre tentatives (`MAX_DELAY_MS`).

---

## Idempotency strategy

- UUID v4 généré client-side AVANT enqueue (`crypto.randomUUID()`)
- Inclus dans payload de chaque tentative
- Route Handler vérifie `idempotency_keys` table (Wave 1)
- 2 tentatives même UUID → 1 update BDD + 1 cache hit serveur
- **Garantie** : pas de double-charge même si retry après timeout incertain

---

## Critères GREEN Wave 4

- Mode avion : 3 mutations enqueued, status=`pending`, visibles dans Dexie
- Réseau revient : `flushQueue` auto via `online` listener (network-listener.client.ts)
- 3 mutations syncées en < 10s
- `audit_logs` Postgres montre 3 INSERT cohérents (pas de doublons)
- Test échec simulé (Route Handler 500) : 3 retry puis status=`dead` + toast Sonner affiché
- Idempotency : 2 `fetch` même UUID → 1 INSERT BDD + 1 cache hit (response `cached: true`)
- typecheck PASS, lint PASS

---

## Anti-patterns / NE PAS FAIRE

- ❌ Generate UUID server-side (perd la garantie idempotence côté client retry)
- ❌ Polling `flushQueue` toutes les X secondes (perte batterie, utiliser events réactifs)
- ❌ Retry infini sans cap (boucle infinie en cas d'erreur permanente serveur)
- ❌ `toast.error` à chaque retry intermédiaire (pollution UI, attendre status=`dead`)
- ❌ Modifier `audit_logs` côté client (server-side via Route Handler uniquement)
- ❌ Bloquer l'UI pendant `flushQueue` (toast non-bloquant, flush asynchrone)
- ❌ FIFO global tous types confondus (FIFO par `resource_id` pour start avant end même ride OK ; rides différents parallélisables côté serveur via idempotency_key)
