-- =============================================================================
-- Migration — Mode alerte météo / cyclone (weather_alerts, DEC-170)
-- =============================================================================
-- CdG l.380-385 / US-REG-09. La Réunion subit chaque saison des alertes cyclone
-- (pré-alerte, alerte orange, rouge, violet). En alerte, l'activité transport est
-- suspendue : la régulatrice doit pouvoir basculer toute l'org en « mode alerte
-- météo » et annuler en masse les courses du jour (statut dédié `annulee_meteo`,
-- ajouté en migration 20260612000008).
--
-- D-01 : table dédiée (pas une colonne sur organizations) — historique/audit des
-- épisodes (qui a activé, quand, motif, zone) + reprise J+1/J+2 ultérieure
-- (extension tracée, hors scope). Un seul mode actif à la fois par org (index
-- unique partiel sur active).
-- Refs : DEC-170 ; pattern RLS de prescribers (lecture org, écriture dirigeant
-- OU régulateur).
-- =============================================================================

-- -- Section 1 — Table weather_alerts -------------------------------------------
create table public.weather_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active boolean not null default true,
  -- motif = niveau/contexte saisi par la régulatrice (ex. « alerte rouge cyclone »).
  motif text not null,
  -- zone = filtre géographique optionnel (ville/secteur). Null = toute l'org.
  zone text,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.weather_alerts is
  'Épisodes de mode alerte météo / cyclone (DEC-170, CdG l.380-385). Un seul actif '
  'par org (index unique partiel). Historique conservé pour audit et reprise J+1/J+2.';

create index weather_alerts_organization_idx on public.weather_alerts (organization_id);

-- Un seul mode actif à la fois par organisation (D-01).
create unique index weather_alerts_one_active
  on public.weather_alerts (organization_id)
  where active;

-- -- Section 2 — RLS forcée + policies ------------------------------------------
-- Lecture : tous les membres de l'org (bandeau cockpit visible par tous).
-- Écriture : dirigeant OU régulateur (la régulatrice pilote l'épisode).
alter table public.weather_alerts enable row level security;
alter table public.weather_alerts force row level security;

create policy weather_alerts_select_same_org on public.weather_alerts
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy weather_alerts_insert_regulateur on public.weather_alerts
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

create policy weather_alerts_update_regulateur on public.weather_alerts
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — l'historique des épisodes est immuable (audit).

revoke all on public.weather_alerts from anon;
grant select, insert, update on public.weather_alerts to authenticated;

-- -- Section 3 — Template SMS « annulation_meteo » ------------------------------
-- Best-effort lors de l'annulation en masse (D-05). Réutilise le socle SMS
-- (renderTemplate, consentement RGPD). Body ≤ 160 chars, additif idempotent.
insert into public.sms_templates (key, body) values
  (
    'annulation_meteo',
    '{{patient_prenom}}, votre transport du {{date}} est annule (alerte meteo). Nous vous recontacterons. TAP Reunion.'
  )
on conflict (key) do nothing;
