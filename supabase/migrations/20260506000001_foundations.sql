-- =============================================================================
-- Migration 001 — Fondations multi-tenant
-- =============================================================================
-- Crée :
--   - extensions de base
--   - type énuméré user_role (dirigeant, regulateur, chauffeur)
--   - table organizations (un tenant = une société TAP)
--   - table profiles (extension de auth.users avec organization_id + role)
--   - table audit_logs (traçabilité des actions sensibles)
--   - triggers updated_at
--   - fonctions helpers SECURITY DEFINER pour RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.user_role as enum (
  'dirigeant',
  'regulateur',
  'chauffeur'
);

comment on type public.user_role is
  'Rôles métier. Pas de super-admin ici : géré hors RLS via service_role.';

-- -----------------------------------------------------------------------------
-- Fonction utilitaire updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger générique : met à jour updated_at à chaque UPDATE.';

-- -----------------------------------------------------------------------------
-- Table organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default extensions.uuid_generate_v4(),
  nom text not null,
  siret text,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email citext,
  numero_agrement_cgss text,
  date_creation timestamptz not null default now(),
  date_archivage timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_siret_format check (
    siret is null or siret ~ '^[0-9]{14}$'
  ),
  constraint organizations_code_postal_974 check (
    code_postal is null or code_postal ~ '^974[0-9]{2}$'
  )
);

comment on table public.organizations is
  'Tenant racine. Une société TAP = une organization.';

create index organizations_actives_idx
  on public.organizations (id)
  where date_archivage is null;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Table profiles (extension de auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  role public.user_role not null,
  prenom text not null,
  nom text not null,
  telephone text,
  email citext not null,
  actif boolean not null default true,
  date_archivage timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil métier rattaché à un compte Supabase Auth. organization_id = tenant.';

create index profiles_organization_idx
  on public.profiles (organization_id)
  where actif is true;

create index profiles_role_idx
  on public.profiles (organization_id, role)
  where actif is true;

create unique index profiles_email_unique
  on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers SECURITY DEFINER pour RLS
-- -----------------------------------------------------------------------------
-- Ces fonctions sont consultées dans les policies RLS. SECURITY DEFINER
-- permet de lire profiles sans déclencher les policies récursivement.
-- -----------------------------------------------------------------------------

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
    and actif is true
  limit 1;
$$;

comment on function public.current_organization_id() is
  'organization_id du profil rattaché à auth.uid(). NULL si non authentifié ou inactif.';

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and actif is true
  limit 1;
$$;

comment on function public.current_user_role() is
  'Rôle du profil rattaché à auth.uid(). NULL si non authentifié ou inactif.';

create or replace function public.has_role(required_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and actif is true
      and role = required_role
  );
$$;

comment on function public.has_role(public.user_role) is
  'TRUE si auth.uid() possède le rôle exact demandé.';

-- -----------------------------------------------------------------------------
-- Table audit_logs
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Journal des actions sensibles. Append-only (pas de UPDATE ni DELETE en RLS).';

create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

create index audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);
