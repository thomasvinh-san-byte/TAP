'use client';

/**
 * Sync engine PWA chauffeur Phase 04.9 (Wave 4).
 *
 * Flush la queue Dexie `mutations_queue` vers les Route Handlers Wave 1
 * (`/api/driver/rides/[id]/{start,end}`) avec :
 *   - Retry exponentiel base 2s + jitter ±500ms, cap 30s
 *   - 3 essais max puis `status='dead'` + toast Sonner destructive
 *   - Idempotency UUID v4 client-generated (`crypto.randomUUID`)
 *   - FIFO par `created_at`
 *
 * Background Sync API non supporté iOS Safari → fallback
 * `window.addEventListener('online')` dans network-listener.client.ts.
 *
 * Refs : PLAN-4, DEC-045 Route Handlers, DEC-019 Dexie 4.x.
 */

import { toast } from 'sonner';
import { getDb } from './dexie-instance';
import type { MutationType } from './dexie-schema';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;
const JITTER_MS = 500;
const MAX_DELAY_MS = 30_000;

function jitter(base: number): number {
  return base + (Math.random() * 2 - 1) * JITTER_MS;
}

function delayForAttempt(attempts: number): number {
  return Math.min(
    jitter(BASE_DELAY_MS * Math.pow(2, attempts - 1)),
    MAX_DELAY_MS,
  );
}

export interface EnqueueInput {
  type: MutationType;
  resource_id: string;
  payload: Record<string, unknown>;
}

export async function enqueue(input: EnqueueInput): Promise<void> {
  const db = getDb();
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

export interface FlushResult {
  flushed: number;
  failed: number;
  dead: number;
}

export async function flushQueue(): Promise<FlushResult> {
  const db = getDb();

  // Cleanup in_flight orphelins — Phase 04.9-ter #6.
  // Si crash browser pendant fetch précédent, des mutations restent
  // status='in_flight' et seraient skipped par le filter anyOf(
  // 'pending', 'failed') ci-dessous. Reset → 'pending' au début de
  // chaque flush pour permettre retry. attempts préservé donc le
  // backoff exponentiel reprend où il s'est arrêté. Si MAX_ATTEMPTS,
  // skipped par `if (m.attempts >= MAX_ATTEMPTS) continue` plus bas.
  // Pattern industry 2026 : tasking.space PWA Edge Sync "deterministic
  // queue + recovery logic at startup", wild.codes "engine detect/reset
  // stale state at boot". Refs : CONCERNS #6 Phase 04.9.
  await db.mutations_queue
    .where('status')
    .equals('in_flight')
    .modify({ status: 'pending' });

  const pending = await db.mutations_queue
    .where('status')
    .anyOf('pending', 'failed')
    .sortBy('created_at');

  let flushed = 0;
  let failed = 0;
  let dead = 0;

  for (const m of pending) {
    if (m.attempts >= MAX_ATTEMPTS) continue;

    await db.mutations_queue.update(m.id!, {
      status: 'in_flight',
      last_attempt_at: new Date(),
    });

    try {
      const path =
        m.type === 'start_ride'
          ? 'start'
          : m.type === 'end_ride'
            ? 'end'
            : 'no-show';
      const endpoint = `/api/driver/rides/${m.resource_id}/${path}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: m.idempotency_key,
          ...(m.payload as object),
        }),
      });

      if (res.ok) {
        await db.mutations_queue.delete(m.id!);
        flushed++;
      } else if (res.status >= 400 && res.status < 500) {
        // 4xx : erreur métier définitive → dead immédiat avec message
        // précis depuis body.error. Retry serait vain (validation,
        // ownership, status conflict 409, not found 404).
        //
        // Pattern industry 2026 : ne JAMAIS retry 4xx sauf 408/429.
        // Notre Route Handler n'émet jamais 408/429 V1.5 (auth → 401,
        // validation → 400, ownership → 403, not found → 404, status
        // conflict → 409). Si futurs codes Phase 06, ajuster ici.
        //
        // Refs : Google Cloud Vertex AI retry strategy, oneuptime
        // network retry strategies 2026, hookdeck DLQ failure
        // categorization, boldsign API retry best practices.
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const errorMsg = body.error ?? `HTTP ${res.status}`;

        await db.mutations_queue.update(m.id!, {
          status: 'dead',
          attempts: MAX_ATTEMPTS,
          last_error: errorMsg,
        });
        dead++;
        toast.error('Synchronisation impossible', {
          description: errorMsg,
        });
        continue;
      } else {
        // 5xx ou autre : erreur serveur → retry exponentiel
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
