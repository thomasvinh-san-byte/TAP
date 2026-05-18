# Plan-1 — Spike Route Handlers + idempotency

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 1/7
**Dépendances**: aucune (démarre direct)
**Estimation**: 1h (vélocité projetée 15-20 min réel)
**Refs**: DEC-045 LOCKED Route Handlers (PR #109), DEC-032 CD push exclusif

---

## Goal

Créer les 2 endpoints REST explicites `/api/driver/rides/[rideId]/start` et `.../end` consommés par le sync engine offline (Wave 4). Les Server Actions existantes `startRideAction` / `endRideAction` restent disponibles pour les mutations online direct (fallback).

Idempotency UUID v4 client-generated dédupée server-side via table `idempotency_keys` avec expiration 24h.

---

## Fichiers à créer

- `apps/web/src/app/api/driver/rides/[rideId]/start/route.ts` — Route Handler POST start
- `apps/web/src/app/api/driver/rides/[rideId]/end/route.ts` — Route Handler POST end
- `apps/web/src/lib/api/driver-auth.ts` — Helper auth Route Handler (cookies Supabase + check role chauffeur)
- `apps/web/src/lib/api/idempotency.ts` — Helper `withIdempotency<T>(key, userId, type, resourceId, fn)`
- `supabase/migrations/<datestamp>_idempotency_keys.sql` — Migration table + RLS

## Fichiers à modifier

- aucun (Server Actions existantes intactes, Route Handlers s'ajoutent)

---

## Migration `idempotency_keys`

```sql
create table public.idempotency_keys (
  key uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_type text not null check (mutation_type in ('start_ride','end_ride')),
  resource_id uuid not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (user_id, mutation_type, resource_id, key)
);

create index idempotency_keys_expires_at_idx
  on public.idempotency_keys (expires_at);

alter table public.idempotency_keys enable row level security;

create policy idempotency_keys_self_only
  on public.idempotency_keys
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

**Cleanup** : `DELETE FROM idempotency_keys WHERE expires_at < now()` à programmer Phase 06 (pg_cron) — inscrit CONCERNS Wave 7.

**Application** : via CD push exclusif (DEC-032), pas via MCP.

---

## Endpoints shape

### POST `/api/driver/rides/[rideId]/start`

**Headers** : Cookie (Supabase session auto), `Content-Type: application/json`
**Body** : `{ idempotency_key: string /* UUID v4 */ }`

**Responses** :
- `200` success : `{ success: true, id: string }`
- `200` cached idempotent : `{ success: true, id: string, cached: true }`
- `400` validation : `{ error: string }`
- `401` auth : `{ error: "Session expirée" }`
- `403` role : `{ error: "Seul un chauffeur peut démarrer" }`
- `404` ride not found : `{ error: "Course introuvable" }`
- `409` status conflict : `{ error: "Course déjà démarrée" }`

### POST `/api/driver/rides/[rideId]/end`

**Body** :
```ts
{
  idempotency_key: string, // UUID v4
  tarif_amount_eur: number,
  payment_status: 'non_concerne' | 'a_encaisser' | 'encaisse',
  payment_method?: 'cash' | 'cb' | 'cheque' | 'cgss_differe'
}
```

**Responses** : identique à `/start` + 200 success body inclut `tarif_amount_eur`, `payment_status`.

---

## Pattern code

```ts
export async function POST(
  req: NextRequest,
  { params }: { params: { rideId: string } }
) {
  // 1. Auth via cookies Supabase (PAS getAuthContext Server Actions only)
  const auth = await requireDriverFromRouteHandler();
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  // 2. Validation Zod payload (réutiliser endRideInputSchema existant pour end)
  const body = await req.json();
  const parsed = startRidePayloadSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Payload invalide' }, { status: 400 });

  // 3. Idempotency check
  return withIdempotency({
    key: parsed.data.idempotency_key,
    userId: auth.userId,
    mutationType: 'start_ride',
    resourceId: params.rideId,
    fn: async () => {
      // 4. Logique métier (mêmes guards que startRideAction)
      const { data, error } = await supabase.rpc('start_ride_safe', { ride_id: params.rideId });
      if (error?.code === 'PGRST116') return { status: 404, body: { error: 'Course introuvable' } };
      if (error?.message?.includes('status_conflict')) return { status: 409, body: { error: 'Course déjà démarrée' } };
      if (error) throw error;
      return { status: 200, body: { success: true, id: data.id } };
    },
  });
}
```

---

## Tests Vitest

Fichiers : `apps/web/src/app/api/driver/rides/__tests__/{start,end}.spec.ts`

Couverture obligatoire (8+ tests par endpoint) :
- 200 success first call
- 200 idempotent cached (same UUID twice → 1 BDD update, 1 cache hit)
- 400 validation Zod (idempotency_key manquant ou non-UUID)
- 401 unauth (no cookie)
- 403 wrong role (régulateur tente start)
- 404 ride not found
- 409 status conflict (déjà `en_cours` pour start, déjà `terminee` pour end)
- end : 400 si `payment_status='encaisse'` sans `payment_method`

---

## Critères GREEN Wave 1

- 2 endpoints répondent les 6 codes attendus
- Table `idempotency_keys` créée + RLS testé (chauffeur A ne voit pas keys de chauffeur B)
- 8+ tests Vitest passent par endpoint (16+ total)
- `curl` manuel local des 2 endpoints OK (preuve visible)
- typecheck PASS, lint PASS (V8 stratégie CI V1.5)

---

## Anti-patterns / NE PAS FAIRE

- ❌ Réutiliser `getAuthContext()` (Server Actions only, ne marche pas dans Route Handler)
- ❌ Skip idempotency check (perte garantie no-duplicate critique)
- ❌ Stocker payload complet dans `response_json` (juste la réponse retournée)
- ❌ Migration via MCP `apply_migration` (DEC-032 strict, CD push exclusif)
- ❌ Modifier les Server Actions existantes (Route Handlers s'ajoutent en parallèle)
- ❌ Cleanup automatique synchrone dans le Route Handler (overhead, faire en cron Phase 06)
