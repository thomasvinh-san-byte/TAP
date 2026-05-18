-- =============================================================================
-- Migration — Phase 04.9 Wave 1 : table idempotency_keys (PWA chauffeur)
-- =============================================================================
-- Déduplication des mutations PWA chauffeur rejouées par le sync engine
-- après reconnexion réseau (mode avion → file d'attente Dexie → flush au
-- retour). Garantit qu'une mutation rejouée avec le même UUID ne crée
-- pas de doublon en BDD.
--
-- Pattern :
--   1. Client génère crypto.randomUUID() avant enqueue Dexie
--   2. Inclus dans payload de chaque tentative HTTP
--   3. Route Handler check (user_id, mutation_type, resource_id, key) :
--      - HIT → return response_json cached (status + body)
--      - MISS → applique mutation + INSERT response_json
--   4. 2 fetch même UUID → 1 UPDATE BDD + 1 cache hit
--
-- Expiration 24h : couvre une journée chauffeur offline + buffer retry.
-- Cleanup pg_cron `DELETE WHERE expires_at < now()` reporté Phase 06.
--
-- RLS self-only : chauffeur A ne voit pas les clés du chauffeur B.
--
-- Refs : DEC-045 LOCKED Route Handlers (PR #109), PLAN-1.md (PR #111),
--        DEC-032 CD push exclusif, DEC-022 mitigation iOS purge.
-- =============================================================================

create table public.idempotency_keys (
  key uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_type text not null check (mutation_type in ('start_ride', 'end_ride')),
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

comment on table public.idempotency_keys is
  'Déduplication mutations offline PWA chauffeur (Phase 04.9 Wave 1, DEC-045 LOCKED). Expiration 24h, cleanup pg_cron Phase 06.';
