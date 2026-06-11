-- =============================================================================
-- Migration — Préférences de notification par utilisateur (DEC-149)
-- =============================================================================
-- Crée :
--   - table public.notification_preferences (1 ligne par user ; PK = user_id)
--   - RLS user-scoped stricte (using user_id = auth.uid())
--   - trigger updated_at
--   - revoke anon, grant authenticated (SELECT/INSERT/UPDATE — pas de DELETE)
--
-- Portée par UTILISATEUR (norme SaaS : chaque régulateur/dirigeant consomme
-- les alertes du cockpit différemment ; le préférence store est par user, pas
-- par organisation). `organization_id` présent pour le multi-tenant mais la
-- granularité reste l'utilisateur (PK user_id).
--
-- Lazy : pas de seed pour les users existants. Une absence de ligne = tous les
-- défauts (tout `true` = comportement actuel, tout affiché). La ligne est créée
-- au 1er changement (upsert applicatif).
--
-- Extensible : les préférences email/push s'ajouteront ICI (colonnes
-- supplémentaires) quand EMAIL_ENABLED sera branché (registre §1.2). Pas de
-- colonne email tant que le canal n'existe pas (pas de préférence dormante).
--
-- Refs : DEC-149 ; CdC §5.13 (alertes cockpit) ; pattern RLS user-scoped de
--        ride_draft (author_id = auth.uid()).
-- =============================================================================

-- -- Section 1 — Table notification_preferences --------------------------------
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Alertes in-app du cockpit (CockpitAlertType). Défaut true = comportement
  -- actuel (toutes les familles affichées). Désactiver masque la famille du
  -- panel cockpit (filtrage d'AFFICHAGE ; la détection temps réel est inchangée).
  alert_patient_no_show boolean not null default true,
  alert_sms_failed boolean not null default true,
  alert_ride_delayed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Préférences de notification par utilisateur (PK user_id). Pilote l''affichage '
  'des alertes in-app du cockpit. Extensible email/push (DEC-149).';

-- -- Section 2 — RLS forcée + policies (user-scoped strict) --------------------
alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- Pas de policy DELETE — une préférence se modifie, ne se supprime pas.

-- -- Section 3 — Trigger updated_at --------------------------------------------
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- -- Section 4 — Revoke / Grant ------------------------------------------------
revoke all on public.notification_preferences from anon;
grant select, insert, update on public.notification_preferences to authenticated;
