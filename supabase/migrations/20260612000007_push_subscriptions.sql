-- =============================================================================
-- Migration — Notifications push PWA chauffeur (push_subscriptions, DEC-167)
-- =============================================================================
-- Trou V1 (CdG l.71 « PWA avec notifications push »). Web Push standard, AUCUNE
-- dépendance HDS/géoloc. Le service worker Serwist gère déjà precache/offline ;
-- ce lot ajoute la couche push (abonnements + envoi VAPID).
--
-- Crée :
--   - table public.push_subscriptions (1..N abonnements par user/appareil)
--   - RLS user-scoped : un user ne gère QUE ses propres abonnements
--   - colonne notification_preferences.push_enabled (extension prévue DEC-149)
-- Refs : DEC-167 ; pattern RLS user-scoped de notification_preferences.
-- =============================================================================

-- -- Section 1 — Table push_subscriptions --------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- endpoint = identifiant unique de l'abonnement (push service du navigateur).
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.push_subscriptions is
  'Abonnements Web Push (PWA chauffeur, DEC-167) — 1..N par user (multi-appareils). '
  'RLS user-scoped. Un 410/404 à l''envoi → suppression (nettoyage des subs morts).';

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -- Section 2 — RLS forcée + policies (user-scoped strict) --------------------
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- -- Section 3 — Préférence push (extension notification_preferences) ----------
-- Le commentaire de la table prévoit explicitement l'ajout des préférences push.
-- Défaut true = comportement « activé » (respecté avant chaque envoi serveur).
alter table public.notification_preferences
  add column push_enabled boolean not null default true;
