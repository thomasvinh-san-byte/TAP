/**
 * SQL de setup auto-généré par scripts/build-setup-sql.sh — NE PAS éditer manuellement.
 * Source: supabase/migrations/*.sql + supabase/seed.sql + supabase/seed.demo.sql
 * Régénération : ./scripts/build-setup-sql.sh
 */

export const SETUP_SQL = String.raw`
-- ==============================================================================
-- TAP Régulation — Setup complet en une seule fois (migrations + seed démo)
-- ==============================================================================
-- À copier-coller intégralement dans Supabase Studio → SQL Editor → Run.
-- Fichier généré automatiquement par scripts/build-setup-sql.sh.
--
-- Contenu :
--   - 10 migrations (001 → 010)
--   - seed.sql       : 1 organization + 4 comptes auth (dirigeant/régulateur/chauffeur)
--   - seed.demo.sql  : 10 patients fictifs réunionnais + notes + contraintes
--
-- Idempotent : peut être ré-exécuté sans casser les données existantes.
-- ==============================================================================


-- ─── supabase/migrations/20260506000001_foundations.sql ─────────────────────────────────────────────────────────────

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
as \$\$
begin
  new.updated_at := now();
  return new;
end;
\$\$;

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
    siret is null or siret ~ '^[0-9]{14}\$'
  ),
  constraint organizations_code_postal_974 check (
    code_postal is null or code_postal ~ '^974[0-9]{2}\$'
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
as \$\$
  select organization_id
  from public.profiles
  where id = auth.uid()
    and actif is true
  limit 1;
\$\$;

comment on function public.current_organization_id() is
  'organization_id du profil rattaché à auth.uid(). NULL si non authentifié ou inactif.';

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as \$\$
  select role
  from public.profiles
  where id = auth.uid()
    and actif is true
  limit 1;
\$\$;

comment on function public.current_user_role() is
  'Rôle du profil rattaché à auth.uid(). NULL si non authentifié ou inactif.';

create or replace function public.has_role(required_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as \$\$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and actif is true
      and role = required_role
  );
\$\$;

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

-- ─── supabase/migrations/20260506000002_rls_foundations.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 002 — Row Level Security sur les tables fondations
-- =============================================================================
-- Active RLS sur organizations, profiles, audit_logs et pose les policies.
-- Règle d'or : un utilisateur ne voit JAMAIS rien hors de son organization_id.
-- Élévation de privilèges interdite (un utilisateur ne peut pas se changer
-- de rôle ni d'organization).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations — RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

-- SELECT : on ne voit que sa propre organization
create policy organizations_select_own
  on public.organizations
  for select
  to authenticated
  using (id = public.current_organization_id());

-- UPDATE : seul le dirigeant peut modifier sa société
create policy organizations_update_dirigeant
  on public.organizations
  for update
  to authenticated
  using (
    id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (
    id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- INSERT et DELETE : interdits via API publique. Création par service_role
-- (onboarding administratif), suppression interdite (archivage logique uniquement).

-- -----------------------------------------------------------------------------
-- profiles — RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- SELECT : on voit les profils de sa propre organization
create policy profiles_select_same_org
  on public.profiles
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

-- UPDATE par soi-même : limité à prenom/nom/telephone (l'élévation de
-- privilège est bloquée par un trigger BEFORE UPDATE plus bas).
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- UPDATE par dirigeant sur les membres de son organization
create policy profiles_update_dirigeant
  on public.profiles
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- INSERT : interdit via API publique (provisioning par service_role).
-- DELETE : interdit (désactivation via actif = false + date_archivage).

-- -----------------------------------------------------------------------------
-- Trigger anti-élévation de privilège sur profiles
-- -----------------------------------------------------------------------------
create or replace function public.profiles_prevent_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as \$\$
declare
  acting_role public.user_role;
begin
  acting_role := public.current_user_role();

  -- Le dirigeant peut tout modifier sur les membres de son organization.
  if acting_role = 'dirigeant'::public.user_role
     and old.organization_id = public.current_organization_id() then
    return new;
  end if;

  -- Tout autre rôle : interdit de changer organization_id, role ou actif.
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Modification interdite : organization_id'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    raise exception 'Modification interdite : role'
      using errcode = '42501';
  end if;

  if new.actif is distinct from old.actif then
    raise exception 'Modification interdite : actif'
      using errcode = '42501';
  end if;

  return new;
end;
\$\$;

comment on function public.profiles_prevent_self_escalation() is
  'Empêche un non-dirigeant de modifier organization_id, role ou actif sur son profil.';

create trigger profiles_prevent_self_escalation
  before update on public.profiles
  for each row
  execute function public.profiles_prevent_self_escalation();

-- -----------------------------------------------------------------------------
-- audit_logs — RLS (append-only pour les utilisateurs)
-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- SELECT : dirigeant uniquement, sur son organization
create policy audit_logs_select_dirigeant
  on public.audit_logs
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- INSERT : tout utilisateur authentifié peut journaliser une action sur
-- sa propre organization, en se déclarant lui-même comme actor.
create policy audit_logs_insert_self
  on public.audit_logs
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (actor_id is null or actor_id = auth.uid())
  );

-- UPDATE et DELETE : interdits côté client (append-only).

-- -----------------------------------------------------------------------------
-- Sécurité supplémentaire : révoquer les droits par défaut
-- -----------------------------------------------------------------------------
revoke all on public.organizations from anon;
revoke all on public.profiles from anon;
revoke all on public.audit_logs from anon;

-- authenticated : seulement ce que les policies autorisent
grant select, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.audit_logs to authenticated;

-- ─── supabase/migrations/20260507000001_patients.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 003 — Référentiel patients
-- =============================================================================
-- Crée :
--   - extensions pg_trgm + unaccent + wrapper public.unaccent_immutable
--   - types énumérés patient_constraint_type (8) + canal_contact_prefere
--   - tables patients / patient_constraint / patient_operational_note
--   - RLS forcée + 10 policies (3 ou 4 selon table)
--   - 2 triggers updated_at + 3 triggers d'audit (NIR exclu du delta)
--   - index GIN pg_trgm + index unique partiel NIR par tenant
--   - vue patients_safe (security_invoker, masque le ciphertext NIR)
-- =============================================================================

-- -- Section 1 — Extensions et wrapper IMMUTABLE -------------------------------
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Wrapper IMMUTABLE pour usage dans une colonne générée stockée
-- (extensions.unaccent est STABLE, sans wrapper Postgres lève
-- « generation expression is not immutable »). Cf. RESEARCH Pitfall 1.
create or replace function public.unaccent_immutable(input text)
returns text language sql immutable parallel safe as \$\$
  select extensions.unaccent('extensions.unaccent', input)
\$\$;

-- -- Section 2 — Types énumérés ------------------------------------------------
create type public.patient_constraint_type as enum (
  'medical_oxygene', 'medical_fauteuil', 'medical_brancard',
  'vehicule_tpmr', 'horaire_matin', 'horaire_apres_midi',
  'accompagnement_obligatoire', 'autre'
);
create type public.canal_contact_prefere as enum ('sms', 'appel', 'aucun');

-- -- Section 3 — Table patients ------------------------------------------------
create table public.patients (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prenom text not null check (length(trim(prenom)) between 1 and 80),
  nom text not null check (length(trim(nom)) between 1 and 80),
  date_naissance date not null,
  genre text check (genre in ('M', 'F', 'X')),
  telephone text,
  telephone_normalized text,
  adresse_ligne1 text not null,
  adresse_ligne2 text,
  code_postal text not null check (code_postal ~ '^974[0-9]{2}\$'),
  ville text not null,
  contact_urgence_nom text,
  contact_urgence_telephone text,
  nir_encrypted bytea,
  nir_search_hash bytea,
  -- Format \`XX YY\` = 2 derniers digits + 2 digits de la clé. Pseudonymisation
  -- partielle (ADR-004 placeholder). Inclus dans le delta d'audit (non-secret).
  nir_last4 text check (nir_last4 is null or nir_last4 ~ '^[0-9]{2}\\s[0-9]{2}\$'),
  canal_contact_prefere public.canal_contact_prefere not null default 'appel',
  consentement_sms boolean not null default false,
  consentement_sms_at timestamptz,
  archive boolean not null default false,
  archive_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint patients_consentement_sms_horodatage check (
    consentement_sms = false or consentement_sms_at is not null
  )
);

alter table public.patients add column search_text text generated always as (
  lower(public.unaccent_immutable(
    coalesce(nom, '') || ' ' || coalesce(prenom, '') || ' ' || coalesce(telephone_normalized, '')
  ))
) stored;

-- -- Section 4 — Index patients ------------------------------------------------
create index patients_organization_archive_idx
  on public.patients (organization_id, archive);
create index patients_search_trgm_idx
  on public.patients using gin (search_text extensions.gin_trgm_ops);
create unique index patients_nir_unique
  on public.patients (organization_id, nir_search_hash)
  where archive = false and nir_search_hash is not null;
create index patients_nir_search_hash_idx
  on public.patients (organization_id, nir_search_hash)
  where archive = false;

-- -- Section 5 — Table patient_constraint --------------------------------------
create table public.patient_constraint (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  type public.patient_constraint_type not null,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create index patient_constraint_patient_idx on public.patient_constraint (patient_id);

-- -- Section 6 — Table patient_operational_note --------------------------------
create table public.patient_operational_note (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  author_id uuid not null references auth.users(id),
  replaced_by_id uuid references public.patient_operational_note(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patient_operational_note_active_idx
  on public.patient_operational_note (patient_id) where replaced_by_id is null;

-- -- Section 7 — RLS forcée + policies (patients) ------------------------------
alter table public.patients enable row level security;
alter table public.patients force row level security;

create policy patients_select_same_org on public.patients
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patients_insert_regulateur on public.patients
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  );

create policy patients_update_regulateur on public.patients
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE : archivage logique via colonne archive.

-- -- Section 8 — RLS forcée + policies (patient_constraint) -------------------
alter table public.patient_constraint enable row level security;
alter table public.patient_constraint force row level security;

create policy patient_constraint_select_same_org on public.patient_constraint
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patient_constraint_insert_regulateur on public.patient_constraint
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  );

create policy patient_constraint_delete_regulateur on public.patient_constraint
  for delete to authenticated
  using (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  );

-- -- Section 9 — RLS forcée + policies (patient_operational_note) -------------
alter table public.patient_operational_note enable row level security;
alter table public.patient_operational_note force row level security;

create policy patient_operational_note_select_same_org on public.patient_operational_note
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patient_operational_note_insert_regulateur on public.patient_operational_note
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  );

create policy patient_operational_note_update_regulateur on public.patient_operational_note
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = public.current_organization_id());

-- -- Section 10 — Triggers updated_at -----------------------------------------
create trigger patients_set_updated_at before update on public.patients
  for each row execute function public.set_updated_at();
create trigger patient_operational_note_set_updated_at before update on public.patient_operational_note
  for each row execute function public.set_updated_at();

-- -- Section 11 — Trigger d'audit patients ------------------------------------
-- Filtre strict de nir_encrypted + nir_search_hash dans les 2 branches
-- (old + new) — JAMAIS de ciphertext dupliqué dans audit_logs.
-- nir_last4 reste inclus (non-secret).
create or replace function public.patients_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'patient.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE')
                  then to_jsonb(old) - 'nir_encrypted' - 'nir_search_hash' else null end,
      'new', case when tg_op in ('INSERT','UPDATE')
                  then to_jsonb(new) - 'nir_encrypted' - 'nir_search_hash' else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger patients_audit_trigger
  after insert or update or delete on public.patients
  for each row execute function public.patients_audit_trigger();

-- -- Section 12 — Trigger d'audit patient_constraint --------------------------
create or replace function public.patient_constraint_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'patient_constraint.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient_constraint', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger patient_constraint_audit_trigger
  after insert or update or delete on public.patient_constraint
  for each row execute function public.patient_constraint_audit_trigger();

-- -- Section 13 — Trigger d'audit patient_operational_note --------------------
create or replace function public.patient_operational_note_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'patient_operational_note.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient_operational_note', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger patient_operational_note_audit_trigger
  after insert or update or delete on public.patient_operational_note
  for each row execute function public.patient_operational_note_audit_trigger();

-- -- Section 14 — Revoke / Grant ----------------------------------------------
revoke all on public.patients from anon;
revoke all on public.patient_constraint from anon;
revoke all on public.patient_operational_note from anon;
grant select, insert, update on public.patients to authenticated;
grant select, insert, delete on public.patient_constraint to authenticated;
grant select, insert, update on public.patient_operational_note to authenticated;

-- -- Section 15 — Vue patients_safe (B-5 ciphertext leak prevention) ----------
-- security_invoker = true → RLS de patients s'applique à l'appelant.
-- Server Actions / RPC search_patients consomment cette vue, pas la table.
create view public.patients_safe with (security_invoker = true) as
  select id, organization_id, nom, prenom, date_naissance, genre,
    telephone, telephone_normalized, adresse_ligne1, adresse_ligne2,
    code_postal, ville, canal_contact_prefere, consentement_sms,
    consentement_sms_at, contact_urgence_nom, contact_urgence_telephone,
    nir_last4, (nir_encrypted is not null) as has_nir, archive,
    archive_at, archive_reason, search_text, created_at, updated_at,
    created_by, updated_by
  from public.patients;
-- nir_encrypted + nir_search_hash NON exposés.
grant select on public.patients_safe to authenticated;

comment on table public.patients is
  'Référentiel patient — NIR chiffré applicatif AES-256-GCM (Edge Function nir).';
comment on view public.patients_safe is
  'Vue safe consommée par Server Actions / RPC. Masque le ciphertext NIR.';

-- ─── supabase/migrations/20260507000002_search_patients_rpc.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 004 — RPC search_patients (recherche fuzzy patient)
-- =============================================================================
-- Crée la fonction RPC public.search_patients(q text) qui retourne
-- setof public.patients_safe (et NON pas la table brute) pour éviter toute
-- fuite de ciphertext NIR (B-5). Consommée par PLAN-5 (UI patient).
--
-- Garanties :
--   - SECURITY = INVOKER (RLS de patients via la vue patients_safe s'applique
--     à l'appelant, pas au propriétaire de la fonction)
--   - filtre length d'au moins 2 côté SQL (court-circuit si l'UI envoie 1 char)
--   - lower(unaccent(q)) aligne strictement avec la colonne générée
--     search_text (cf. migration 003 section 3)
--   - cap dur à 10 résultats (ranking client sur 10 max)
--   - revoke all + grant execute only to authenticated (anon ne peut pas
--     appeler la fonction)
-- =============================================================================

create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public, extensions
as \$\$
  select *
  from public.patients_safe
  where organization_id = public.current_organization_id()
    and length(q) >= 2
    and search_text % lower(extensions.unaccent(q))
  order by extensions.similarity(
    search_text, lower(extensions.unaccent(q))
  ) desc
  limit 10;
\$\$;

comment on function public.search_patients(text) is
  'Recherche fuzzy patient (pg_trgm). Retourne setof patients_safe — masque
le ciphertext NIR. RLS héritée via SECURITY = INVOKER.';

revoke all on function public.search_patients(text) from public;
grant execute on function public.search_patients(text) to authenticated;

-- ─── supabase/migrations/20260508000001_legal_compliance.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration Phase 1.5 — Conformité RGPD : registre traitements (art. 30),
-- DPA (art. 28), DPIA (art. 35), violations (art. 33), demandes droits
-- (art. 15-21). Verrouille D-05..D-09 du CONTEXT 1.5.
-- =============================================================================
-- Crée :
--   - 5 tables : data_processing_register, dpa_record, dpia_record,
--     data_breach_incident, patient_data_request
--   - RLS forcée + policies (D-16 dirigeant only INSERT, isolation tenant)
--   - 5 audit triggers (filtres : request_token, requester_proof_of_identity_url,
--     cnil_notification_reference)
--   - Trigger BEFORE INSERT patient_data_request.deadline_at (auto +30 jours)
--   - Indexes
-- =============================================================================

-- -- Section 1 — Tables (verbatim CONTEXT.md D-05..D-09) ---------------------

-- D-05 — registre des activités de traitement (art. 30 RGPD)
-- Versioning par lignes : pas de policy UPDATE (chaque modif = nouvelle ligne).
create table public.data_processing_register (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purpose text not null,
  legal_basis text not null check (legal_basis in (
    'consentement', 'contrat', 'obligation_legale',
    'mission_interet_public', 'interet_legitime', 'sauvegarde_vie'
  )),
  data_categories text[] not null,
  data_subjects text[] not null,
  recipients text[] not null,
  retention_period_days int not null,
  security_measures text not null,
  international_transfer boolean not null default false,
  international_transfer_safeguards text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

-- D-06 — DPA (art. 28 RGPD) avec sous-traitants Supabase, Twilio, etc.
create table public.dpa_record (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subprocessor_name text not null,
  subprocessor_role text not null,
  dpa_version text not null,
  dpa_document_url text,
  signed_at date not null,
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- D-07 — DPIA / PIA (art. 35 RGPD) versionnée
create table public.dpia_record (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  scope text not null,
  data_flow_diagram text,
  risks_identified jsonb not null default '[]'::jsonb,
  mitigations jsonb not null default '[]'::jsonb,
  residual_risk_level text check (residual_risk_level in ('faible', 'moyen', 'eleve')),
  cnil_consultation_required boolean not null default false,
  cnil_consultation_date date,
  reviewed_at date not null,
  next_review_at date not null,
  status text not null check (status in ('brouillon', 'validee', 'archivee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- D-08 — Tracker violations (art. 33 RGPD, notification CNIL 72h)
create table public.data_breach_incident (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  detected_at timestamptz not null,
  severity text not null check (severity in ('faible', 'moyen', 'eleve', 'critique')),
  nature text not null check (nature in ('confidentialite', 'integrite', 'disponibilite')),
  affected_data_categories text[] not null,
  affected_subjects_count int,
  description text not null,
  immediate_measures text not null,
  cnil_notification_required boolean not null default false,
  cnil_notification_at timestamptz,
  cnil_notification_reference text,
  subjects_notification_required boolean not null default false,
  subjects_notified_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- D-09 — Demandes de droits art. 15-21 (portail patient)
create table public.patient_data_request (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  request_type text not null check (request_type in (
    'acces', 'rectification', 'effacement',
    'limitation', 'portabilite', 'opposition'
  )),
  requested_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  status text not null check (status in (
    'recue', 'en_cours', 'satisfaite', 'rejetee', 'partiellement_satisfaite'
  )),
  response text,
  response_at timestamptz,
  response_by uuid references auth.users(id) on delete set null,
  request_token text not null unique,
  request_token_expires_at timestamptz not null,
  requester_email text,
  requester_proof_of_identity_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -- Section 2 — Indexes ------------------------------------------------------
create index data_processing_register_org_idx
  on public.data_processing_register (organization_id);
create index dpa_record_org_idx
  on public.dpa_record (organization_id);
create index dpia_record_org_status_idx
  on public.dpia_record (organization_id, status);
create index data_breach_incident_org_open_idx
  on public.data_breach_incident (organization_id) where closed_at is null;
create unique index patient_data_request_token_idx
  on public.patient_data_request (request_token);
create index patient_data_request_org_status_idx
  on public.patient_data_request (organization_id, status, deadline_at);

-- -- Section 3 — RLS forcée + policies ---------------------------------------

-- data_processing_register : SELECT same org + INSERT dirigeant only
-- PAS de policy UPDATE (D-05 versioning par lignes).
alter table public.data_processing_register enable row level security;
alter table public.data_processing_register force row level security;

create policy data_processing_register_select_same_org on public.data_processing_register
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy data_processing_register_insert_dirigeant on public.data_processing_register
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- dpa_record
alter table public.dpa_record enable row level security;
alter table public.dpa_record force row level security;

create policy dpa_record_select_same_org on public.dpa_record
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy dpa_record_insert_dirigeant on public.dpa_record
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy dpa_record_update_dirigeant on public.dpa_record
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());

-- dpia_record
alter table public.dpia_record enable row level security;
alter table public.dpia_record force row level security;

create policy dpia_record_select_same_org on public.dpia_record
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy dpia_record_insert_dirigeant on public.dpia_record
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy dpia_record_update_dirigeant on public.dpia_record
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());

-- data_breach_incident
alter table public.data_breach_incident enable row level security;
alter table public.data_breach_incident force row level security;

create policy data_breach_incident_select_same_org on public.data_breach_incident
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy data_breach_incident_insert_dirigeant on public.data_breach_incident
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy data_breach_incident_update_dirigeant on public.data_breach_incident
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());

-- patient_data_request
alter table public.patient_data_request enable row level security;
alter table public.patient_data_request force row level security;

create policy patient_data_request_select_same_org on public.patient_data_request
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patient_data_request_insert_dirigeant on public.patient_data_request
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy patient_data_request_update_dirigeant on public.patient_data_request
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());

-- -- Section 4 — Triggers updated_at -----------------------------------------
create trigger data_processing_register_set_updated_at
  before update on public.data_processing_register
  for each row execute function public.set_updated_at();
create trigger dpa_record_set_updated_at
  before update on public.dpa_record
  for each row execute function public.set_updated_at();
create trigger dpia_record_set_updated_at
  before update on public.dpia_record
  for each row execute function public.set_updated_at();
create trigger data_breach_incident_set_updated_at
  before update on public.data_breach_incident
  for each row execute function public.set_updated_at();
create trigger patient_data_request_set_updated_at
  before update on public.patient_data_request
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger BEFORE INSERT patient_data_request.deadline_at -----
-- Auto-renseigne deadline_at = requested_at + 30 jours si NULL fourni.
-- Garantit l'art. 12 RGPD (délai légal de réponse).
create or replace function public.patient_data_request_set_deadline()
returns trigger language plpgsql as \$\$
begin
  if new.deadline_at is null then
    new.deadline_at := new.requested_at + interval '30 days';
  end if;
  return new;
end; \$\$;

create trigger patient_data_request_set_deadline_trigger
  before insert on public.patient_data_request
  for each row execute function public.patient_data_request_set_deadline();

-- -- Section 6 — Audit triggers (5 fonctions, pattern patients.sql dupliqué)

-- data_processing_register : pas de filtre (aucun secret)
create or replace function public.data_processing_register_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'data_processing_register.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'data_processing_register', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger data_processing_register_audit_trigger
  after insert or update or delete on public.data_processing_register
  for each row execute function public.data_processing_register_audit_trigger();

-- dpa_record : pas de filtre
create or replace function public.dpa_record_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'dpa_record.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'dpa_record', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger dpa_record_audit_trigger
  after insert or update or delete on public.dpa_record
  for each row execute function public.dpa_record_audit_trigger();

-- dpia_record : pas de filtre (jsonb risques/mitigations = pas secret)
create or replace function public.dpia_record_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'dpia_record.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'dpia_record', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger dpia_record_audit_trigger
  after insert or update or delete on public.dpia_record
  for each row execute function public.dpia_record_audit_trigger();

-- data_breach_incident : filtre cnil_notification_reference (numéro ARS-CNIL sensible)
create or replace function public.data_breach_incident_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'data_breach_incident.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'data_breach_incident', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE')
                  then to_jsonb(old) - 'cnil_notification_reference' else null end,
      'new', case when tg_op in ('INSERT','UPDATE')
                  then to_jsonb(new) - 'cnil_notification_reference' else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger data_breach_incident_audit_trigger
  after insert or update or delete on public.data_breach_incident
  for each row execute function public.data_breach_incident_audit_trigger();

-- patient_data_request : filtre request_token + requester_proof_of_identity_url
-- Pitfall 2 RESEARCH : ces 2 colonnes ne doivent JAMAIS apparaître en clair
-- dans audit_logs.metadata.
create or replace function public.patient_data_request_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'patient_data_request.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient_data_request', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE')
                  then to_jsonb(old) - 'request_token' - 'requester_proof_of_identity_url'
                  else null end,
      'new', case when tg_op in ('INSERT','UPDATE')
                  then to_jsonb(new) - 'request_token' - 'requester_proof_of_identity_url'
                  else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger patient_data_request_audit_trigger
  after insert or update or delete on public.patient_data_request
  for each row execute function public.patient_data_request_audit_trigger();

-- -- Section 7 — Revoke / Grant ----------------------------------------------
-- data_processing_register : pas d'UPDATE (D-05 versioning par lignes)
revoke all on public.data_processing_register from anon;
grant select, insert on public.data_processing_register to authenticated;

revoke all on public.dpa_record from anon;
grant select, insert, update on public.dpa_record to authenticated;

revoke all on public.dpia_record from anon;
grant select, insert, update on public.dpia_record to authenticated;

revoke all on public.data_breach_incident from anon;
grant select, insert, update on public.data_breach_incident to authenticated;

revoke all on public.patient_data_request from anon;
grant select, insert, update on public.patient_data_request to authenticated;

-- -- Section 8 — Comments ----------------------------------------------------
comment on table public.data_processing_register is
  'Registre des activités de traitement (art. 30 RGPD). Versioning par lignes (pas de UPDATE).';
comment on table public.dpa_record is
  'DPA signés avec sous-traitants (art. 28 RGPD) — Supabase, Twilio, etc.';
comment on table public.dpia_record is
  'Analyses d''impact protection des données (art. 35 RGPD).';
comment on table public.data_breach_incident is
  'Tracker violations de données (art. 33 RGPD, notification CNIL 72h).';
comment on table public.patient_data_request is
  'Demandes de droits art. 15-21 RGPD via portail patient (token signé).';

-- ─── supabase/migrations/20260508000002_legal_additional_tables.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration Phase 1.5 — Tables additionnelles RGPD
-- =============================================================================
-- Crée 3 tables :
--   - cgu_acceptance : trace acceptance CGU/CGV par utilisateur (D-22 versioning)
--   - cookie_consent_log : trace consentement cookies (D-14, anon possible)
--   - legal_request_attempts : rate limit portail patient (D-20, 5/h par token)
-- =============================================================================

-- -- cgu_acceptance ----------------------------------------------------------
-- Trace acceptance CGU/CGV par profile + version (frontmatter MDX 'version').
-- Visible/écrivable uniquement par le profil concerné.
create table public.cgu_acceptance (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version text not null,
  document_type text not null check (document_type in ('cgu', 'cgv', 'confidentialite')),
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index cgu_acceptance_profile_idx on public.cgu_acceptance (profile_id);
create index cgu_acceptance_profile_doc_idx
  on public.cgu_acceptance (profile_id, document_type, accepted_at desc);

alter table public.cgu_acceptance enable row level security;
alter table public.cgu_acceptance force row level security;

create policy cgu_acceptance_select_own on public.cgu_acceptance
  for select to authenticated
  using (profile_id = auth.uid());

create policy cgu_acceptance_insert_own on public.cgu_acceptance
  for insert to authenticated
  with check (profile_id = auth.uid());

revoke all on public.cgu_acceptance from anon;
grant select, insert on public.cgu_acceptance to authenticated;

comment on table public.cgu_acceptance is
  'Trace acceptance CGU/CGV/Confidentialité par utilisateur — D-22 versioning par MDX frontmatter.';

-- -- cookie_consent_log -----------------------------------------------------
-- Bandeau cookies CNIL (D-14). Pas d'organization_id : visiteur anonyme
-- possible avant authentification. service_role only.
create table public.cookie_consent_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  session_token_hash text not null,
  choices jsonb not null,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index cookie_consent_log_created_at_idx
  on public.cookie_consent_log (created_at desc);
create index cookie_consent_log_session_idx
  on public.cookie_consent_log (session_token_hash);

alter table public.cookie_consent_log enable row level security;
alter table public.cookie_consent_log force row level security;

-- service_role only — Server Actions / Edge Functions writeurs
create policy cookie_consent_log_insert_service on public.cookie_consent_log
  for insert to service_role with check (true);
create policy cookie_consent_log_select_service on public.cookie_consent_log
  for select to service_role using (true);

revoke all on public.cookie_consent_log from authenticated, anon;

comment on table public.cookie_consent_log is
  'Bandeau cookies CNIL — D-14. Hash session token (pas d''ID utilisateur).';

-- -- legal_request_attempts -------------------------------------------------
-- Rate limit portail patient (D-20) : max 5 tentatives / heure par token.
-- Purge quotidienne pg_cron (Pitfall 6 RESEARCH) — voir migration 03.
create table public.legal_request_attempts (
  id uuid primary key default extensions.uuid_generate_v4(),
  token_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index legal_request_attempts_token_time_idx
  on public.legal_request_attempts (token_hash, attempted_at desc);

alter table public.legal_request_attempts enable row level security;
alter table public.legal_request_attempts force row level security;

create policy legal_request_attempts_service on public.legal_request_attempts
  for all to service_role using (true) with check (true);

revoke all on public.legal_request_attempts from authenticated, anon;

comment on table public.legal_request_attempts is
  'Rate limit portail patient — D-20, max 5 tentatives/h par token (Server Action).';

-- ─── supabase/migrations/20260508000003_breach_72h_alert.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration Phase 1.5 — Watchdog 72h notification CNIL + purge rate limit
-- =============================================================================
-- D-08 (notification CNIL 72h obligatoire art. 33 RGPD).
-- Crée :
--   - extension pg_cron (gérée par Supabase Cloud, absente local Docker)
--   - public.check_breach_deadlines() : insère breach.deadline_warning quand
--     un breach > 66h n'a pas encore été notifié à la CNIL
--   - public.purge_legal_request_attempts() : purge entries > 7 jours
--   - cron.schedule('breach-72h-watchdog', '0 * * * *', ...) — horaire
--   - cron.schedule('legal-request-attempts-purge', '0 3 * * *', ...) — quotidien
-- =============================================================================
-- Note CI : si pg_cron absent (sandbox locale, docker registry bloqué),
-- les \`select cron.schedule(...)\` sont guardés via DO block conditionnel.
-- En production Supabase Cloud, pg_cron est pré-installé.
-- =============================================================================

-- pg_cron : pré-installé sur Supabase Cloud. Localement absent → guard.
do \$\$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  else
    raise notice 'pg_cron non disponible (sandbox locale) — cron.schedule sera skip.';
  end if;
end;
\$\$;

-- -- check_breach_deadlines() : watchdog 72h -------------------------------
-- Pour chaque data_breach_incident dont :
--   - cnil_notification_required = true
--   - cnil_notification_at IS NULL
--   - closed_at IS NULL
--   - now() > detected_at + 66 heures (i.e. moins de 6h restantes avant 72h)
-- → insère un audit_log action='breach.deadline_warning' avec metadata.hours_remaining.
create or replace function public.check_breach_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as \$\$
declare r record;
begin
  for r in
    select id, organization_id, detected_at
    from public.data_breach_incident
    where cnil_notification_required = true
      and cnil_notification_at is null
      and closed_at is null
      and now() > detected_at + interval '66 hours'
  loop
    insert into public.audit_logs
      (organization_id, actor_id, actor_role, action,
       entity_type, entity_id, metadata)
    values (
      r.organization_id, null, null, 'breach.deadline_warning',
      'data_breach_incident', r.id,
      jsonb_build_object(
        'hours_remaining',
        extract(epoch from (r.detected_at + interval '72 hours' - now())) / 3600
      )
    );
  end loop;
end;
\$\$;

comment on function public.check_breach_deadlines() is
  'Watchdog 72h notification CNIL (art. 33 RGPD) — exécuté horaire par pg_cron.';

-- -- purge_legal_request_attempts() : nettoyage rate limit ------------------
create or replace function public.purge_legal_request_attempts()
returns void
language plpgsql
security definer
set search_path = public
as \$\$
begin
  delete from public.legal_request_attempts
  where attempted_at < now() - interval '7 days';
end;
\$\$;

comment on function public.purge_legal_request_attempts() is
  'Purge legal_request_attempts > 7 jours (Pitfall 6 RESEARCH) — exécuté quotidien.';

-- -- cron.schedule (guardé : DO block si extension présente) ----------------
do \$\$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Watchdog 72h breach : exécution horaire
    perform cron.schedule(
      'breach-72h-watchdog',
      '0 * * * *',
      \$cron\$ select public.check_breach_deadlines(); \$cron\$
    );
    -- Purge rate limit attempts : 03h00 chaque nuit
    perform cron.schedule(
      'legal-request-attempts-purge',
      '0 3 * * *',
      \$cron\$ select public.purge_legal_request_attempts(); \$cron\$
    );
  end if;
end;
\$\$;

-- ─── supabase/migrations/20260508000004_organizations_dpo_fields.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration Phase 1.5 — Champs DPO organizations + CGU profiles
-- =============================================================================
-- D-15 (DPO contact) + D-22 (CGU versioning par profile).
-- Ajoute :
--   - organizations.dpo_contact_email, dpo_contact_phone, dpo_contact_address,
--     dpo_external (boolean), dpo_updated_at
--   - profiles.cgu_version_accepted, cgu_accepted_at
-- =============================================================================

alter table public.organizations
  add column if not exists dpo_contact_email text,
  add column if not exists dpo_contact_phone text,
  add column if not exists dpo_contact_address text,
  add column if not exists dpo_external boolean not null default false,
  add column if not exists dpo_updated_at timestamptz;

comment on column public.organizations.dpo_contact_email is
  'Email DPO (D-15) — affiché page /legal/dpo. Modifiable par dirigeant.';
comment on column public.organizations.dpo_external is
  'true = cabinet externe / DPO mutualisé, false = DPO interne dirigeant formé.';

alter table public.profiles
  add column if not exists cgu_version_accepted text,
  add column if not exists cgu_accepted_at timestamptz;

comment on column public.profiles.cgu_version_accepted is
  'Version CGU/CGV acceptée (D-22). Si < version courante MDX → banner update.';

-- ─── supabase/migrations/20260508000005_rgpd_anonymize_rpc.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration Phase 1.5 — RPC RGPD : anonymisation art. 17 + match NIR portail
-- =============================================================================
-- D-09 (effacement art. 17 = anonymisation, JAMAIS DELETE patient ni rides).
-- R5 RESEARCH : conservation rides (CSS L114-19, 5 ans) — ce RPC ne touche
-- pas aux courses/billings.
--
-- B-1 fix (revision 2/3) : RPC nir_match_patient_for_legal_request requise
-- par Plan 05 task 5.2 verifyIdentityAction (portail patient).
-- =============================================================================

-- -- Pré-requis : relaxer NOT NULL sur colonnes anonymisables --------------
-- L'anonymisation art. 17 met prenom/nom/date_naissance/adresse_ligne1/ville
-- à NULL. Sans cette ALTER, le UPDATE du RPC échoue. Garde le check_postal
-- (974XX) car la valeur NULL passe le check (\`code_postal is null or ...\`).
alter table public.patients alter column prenom drop not null;
alter table public.patients alter column nom drop not null;
alter table public.patients alter column date_naissance drop not null;
alter table public.patients alter column adresse_ligne1 drop not null;
alter table public.patients alter column code_postal drop not null;
alter table public.patients alter column ville drop not null;

-- -- public.rgpd_anonymize_patient(uuid, uuid, text) -----------------------
-- Effacement RGPD art. 17 — anonymise un patient sans le supprimer :
--   - Identité directe → NULL (prenom, nom, telephone, adresse, contact_urgence)
--   - NIR : ciphertext + last4 → NULL ; nir_search_hash rehashé avec salt
--     (anti-réidentification cross-org si l'attaquant connaît le hash original)
--   - Consentement SMS → false
--   - archive=true, archive_reason='rgpd.art17.anonymisation'
--   - Suppression notes + contraintes opérationnelles (pas de durée légale)
--   - Rides + billings CONSERVÉS (CSS L114-19, 5 ans)
--   - Audit log patient.anonymized
-- Advisory lock : empêche anonymisations parallèles du même patient.
create or replace function public.rgpd_anonymize_patient(
  p_patient_id uuid,
  p_request_id uuid,
  p_salt text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as \$\$
declare
  v_org_id uuid;
  v_old_search_hash bytea;
  v_lock_key bigint;
begin
  -- Advisory lock : empêche double-call concurrent du même patient
  v_lock_key := ('x' || substr(md5(p_patient_id::text), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_lock_key);

  -- Récupération + lock de la ligne patient
  select organization_id, nir_search_hash
    into v_org_id, v_old_search_hash
  from public.patients
  where id = p_patient_id
  for update;

  if v_org_id is null then
    raise exception 'Patient introuvable : %', p_patient_id;
  end if;

  -- Anonymisation : NULL identifiants directs, hash NIR rotated
  update public.patients set
    prenom = null,
    nom = null,
    date_naissance = null,
    genre = null,
    telephone = null,
    telephone_normalized = null,
    adresse_ligne1 = null,
    adresse_ligne2 = null,
    ville = null,
    contact_urgence_nom = null,
    contact_urgence_telephone = null,
    nir_encrypted = null,
    nir_last4 = null,
    nir_search_hash = extensions.digest(
      coalesce(encode(v_old_search_hash, 'hex'), '') || p_salt,
      'sha256'
    ),
    consentement_sms = false,
    consentement_sms_at = null,
    archive = true,
    archive_at = now(),
    archive_reason = 'rgpd.art17.anonymisation',
    updated_at = now()
  where id = p_patient_id;

  -- Suppression PII opérationnelles (pas de durée légale)
  delete from public.patient_constraint where patient_id = p_patient_id;
  delete from public.patient_operational_note where patient_id = p_patient_id;

  -- Audit log
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action,
     entity_type, entity_id, metadata)
  values (
    v_org_id, auth.uid(), public.current_user_role(),
    'patient.anonymized', 'patient', p_patient_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'retention_basis', 'css_l114_19',
      'anonymized_at', now()
    )
  );
end;
\$\$;

revoke execute on function public.rgpd_anonymize_patient(uuid, uuid, text) from public, anon;
grant execute on function public.rgpd_anonymize_patient(uuid, uuid, text) to authenticated;

comment on function public.rgpd_anonymize_patient(uuid, uuid, text) is
  'RGPD art. 17 — anonymise un patient (UPDATE only, jamais DELETE). Conserve rides (CSS L114-19).';

-- -- public.nir_match_patient_for_legal_request(uuid, bytea, text, date) ----
-- B-1 fix : portail patient. Compare le NIR fourni (déchiffré côté Edge
-- Function NIR puis hashé à nouveau) au patient cible. Match exact (NIR +
-- nom unaccent + date naissance) dans la même org. Retourne uuid ou NULL.
-- SECURITY DEFINER pour traverser RLS (le portail patient n'a pas de session
-- Supabase authentifiée — le rate-limit est géré côté Server Action).
create or replace function public.nir_match_patient_for_legal_request(
  p_request_id uuid,
  p_nir_search_hash bytea,
  p_nom text,
  p_date_naissance date
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as \$\$
declare
  v_patient_id uuid;
  v_org_id uuid;
begin
  -- Récupérer organization_id de la requête (sans exposer plus)
  select organization_id into v_org_id
  from public.patient_data_request
  where id = p_request_id;

  if v_org_id is null then
    return null;
  end if;

  -- Match exact NIR + nom (insensible casse + accents) + date naissance,
  -- scoped à l'org de la requête. archive=false (pas de match patient anonymisé).
  select id into v_patient_id
  from public.patients
  where organization_id = v_org_id
    and nir_search_hash = p_nir_search_hash
    and lower(public.unaccent_immutable(nom)) = lower(public.unaccent_immutable(p_nom))
    and date_naissance = p_date_naissance
    and archive = false
  limit 1;

  return v_patient_id;
end;
\$\$;

revoke all on function public.nir_match_patient_for_legal_request(uuid, bytea, text, date) from public;
grant execute on function public.nir_match_patient_for_legal_request(uuid, bytea, text, date) to authenticated, service_role;

comment on function public.nir_match_patient_for_legal_request(uuid, bytea, text, date) is
  'B-1 fix — Portail patient verifyIdentityAction. SECURITY DEFINER, scoped à l''org de la requête.';

-- ─── supabase/migrations/20260509000001_rides.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 004 — Courses (rides + ride_draft)
-- =============================================================================
-- Crée :
--   - 3 enums : ride_transport_mode (4), ride_urgency (3), ride_status (8)
--   - table rides : saisie express V1 (sans pricing/recurrence/driver — futurs)
--   - table ride_draft : brouillons RGPD-compliant (author_id scoping, pas localStorage)
--   - RLS forcée sur les deux tables + policies
--     (regulateur+dirigeant pour rides ; brouillons author-only pour ride_draft)
--   - 2 triggers updated_at + 1 trigger d'audit (rides UNIQUEMENT — D-10)
--   - 3 indexes sur rides (org+scheduled_at, patient_idx, partial status='validee')
--   - 1 index sur ride_draft (author_id + updated_at)
-- Refs : D-01 / D-02 / D-10 ; pattern dupliqué de 20260507000001_patients.sql
-- =============================================================================

-- -- Section 1 — Types énumérés ------------------------------------------------
create type public.ride_transport_mode as enum (
  'taxi_conventionne',  -- taxi conventionné CGSS
  'tpmr',                -- transport personne à mobilité réduite (fauteuil)
  'vsl',                 -- véhicule sanitaire léger (agrément ARS)
  'ambulance'            -- ambulance (V2 — exposé pour future-proofing)
);

create type public.ride_urgency as enum (
  'programmee',          -- créneau planifié à l'avance
  'urgente',             -- à caser dans la journée
  'immediate'            -- < 1h, alerte cockpit
);

create type public.ride_status as enum (
  'brouillon',           -- pas encore validée (uniquement via ride_draft V1)
  'validee',             -- créée, en attente d'assignation chauffeur (V1 = état terminal)
  'assignee',            -- chauffeur affecté (Phase 6)
  'en_cours',            -- chauffeur a démarré (Phase 9)
  'terminee',            -- course clôturée (Phase 9)
  'annulee_regulateur',  -- annulée avant assignation
  'annulee_patient',     -- annulée par patient (Phase 7 imprévus)
  'annulee_chauffeur'    -- annulée par chauffeur (Phase 7 imprévus)
);

-- -- Section 2 — Table rides ---------------------------------------------------
create table public.rides (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  scheduled_at timestamptz not null,
  pickup_address text not null,
  pickup_postal_code text,
  pickup_city text,
  dropoff_address text not null,
  dropoff_postal_code text,
  dropoff_city text,
  transport_mode public.ride_transport_mode not null default 'taxi_conventionne',
  urgency public.ride_urgency not null default 'programmee',
  status public.ride_status not null default 'validee',
  notes_regulateur text,
  -- Champs futurs commentés pour rappel (à activer en migrations 005/006/007) :
  -- prescription_id uuid references public.prescriptions(id),
  -- ride_recurrence_id uuid references public.ride_recurrences(id),
  -- driver_id uuid references public.drivers(id),
  -- vehicle_id uuid references public.vehicles(id),
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  constraint notes_regulateur_max_500 check (
    notes_regulateur is null or char_length(notes_regulateur) <= 500
  )
);

-- -- Section 3 — Index rides ---------------------------------------------------
create index rides_org_scheduled_idx
  on public.rides (organization_id, scheduled_at desc);
create index rides_patient_idx
  on public.rides (patient_id);
create index rides_status_validee_idx
  on public.rides (organization_id, status)
  where status = 'validee';

-- -- Section 4 — RLS forcée + policies (rides) --------------------------------
alter table public.rides enable row level security;
alter table public.rides force row level security;

create policy rides_select_same_org on public.rides
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy rides_insert_regulateur_dirigeant on public.rides
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy rides_update_regulateur_dirigeant on public.rides
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive (D-01).

-- -- Section 5 — Trigger updated_at (rides) -----------------------------------
create trigger rides_set_updated_at
  before update on public.rides
  for each row execute function public.set_updated_at();

-- -- Section 6 — Trigger d'audit rides ----------------------------------------
-- Aucune colonne sensible chiffrée à filtrer (NIR n'est pas dans rides).
-- Audit complet via to_jsonb(old) / to_jsonb(new) — pattern Phase 1 patients.
create or replace function public.rides_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as \$\$
declare action_name text;
begin
  action_name := 'ride.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'ride', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; \$\$;

create trigger rides_audit_trigger
  after insert or update or delete on public.rides
  for each row execute function public.rides_audit_trigger();

-- -- Section 7 — Table ride_draft ---------------------------------------------
-- Brouillons RGPD-compliant (D-02) : DB plutôt que localStorage car contient
-- potentiellement des données patient. RLS author-scoped strict (Pitfall 4
-- RESEARCH — DEUX prédicats author_id ET organization_id pour empêcher tout
-- contournement par un régulateur de la même org).
create table public.ride_draft (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ride_draft_author_idx
  on public.ride_draft (author_id, updated_at desc);

-- -- Section 8 — RLS forcée + policy unique (ride_draft) ----------------------
alter table public.ride_draft enable row level security;
alter table public.ride_draft force row level security;

-- Policy ALL : lecture, écriture, mise à jour, suppression UNIQUEMENT par
-- l'auteur ET dans son organization. Deux prédicats — paranoïa multi-tenant.
create policy ride_draft_owner_all on public.ride_draft
  for all to authenticated
  using (
    author_id = auth.uid()
    and organization_id = public.current_organization_id()
  )
  with check (
    author_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

-- -- Section 9 — Trigger updated_at (ride_draft) -----------------------------
create trigger ride_draft_set_updated_at
  before update on public.ride_draft
  for each row execute function public.set_updated_at();
-- PAS de trigger d'audit sur ride_draft (D-10 — donnée transitoire).

-- -- Section 10 — Revoke / Grant ---------------------------------------------
revoke all on public.rides from anon;
grant select, insert, update on public.rides to authenticated;

revoke all on public.ride_draft from anon;
grant select, insert, update, delete on public.ride_draft to authenticated;

-- -- Section 11 — Commentaires documentaires --------------------------------
comment on table public.rides is
  'Courses (saisie express V1) — D-01. Champs prescription/recurrence/driver à venir.';
comment on table public.ride_draft is
  'Brouillons de saisie course (RGPD — DB plutôt que localStorage). D-02.';
comment on function public.rides_audit_trigger() is
  'Trigger audit rides — INSERT/UPDATE/DELETE → audit_logs (action ride.*). D-10.';

-- ─── seed.sql ────────────────────────────────────────────────────────

-- =============================================================================
-- Seed — Données de démonstration locales uniquement
-- =============================================================================
-- Crée 1 organization de démo + 3 comptes (dirigeant, régulateur, chauffeur).
-- À NE JAMAIS exécuter en production. Ce fichier est appliqué automatiquement
-- par \`supabase db reset\` en local.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organization de démo
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, siret, ville, code_postal, telephone, email)
values (
  '00000000-0000-0000-0000-000000000001',
  'TAP Démo Réunion',
  '12345678901234',
  'Saint-Denis',
  '97400',
  '0262000000',
  'contact@demo.tap'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Comptes Auth + identités + profils
-- -----------------------------------------------------------------------------
-- Mot de passe : demo1234! (haché bcrypt via pgcrypto/crypt)
--
-- 3 inserts par compte (ordre IMPORTANT) :
--   1. auth.users           — identifiant + mot de passe
--   2. auth.identities      — REQUIS depuis GoTrue v2.x sinon
--                              signInWithPassword renvoie "Invalid login credentials"
--   3. public.profiles      — métier (organization_id, rôle)
--
-- Helper local pour éviter la duplication.
-- -----------------------------------------------------------------------------

create or replace function pg_temp.seed_demo_user(
  p_user_id uuid,
  p_email text,
  p_password text,
  p_org_id uuid,
  p_role text,
  p_prenom text,
  p_nom text
) returns void language plpgsql as \$fn\$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    p_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', p_prenom, 'nom', p_nom)
  )
  on conflict (id) do update
    set encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at,
        updated_at = now();

  -- auth.identities — provider_id = user_id::text pour le provider 'email'.
  -- La colonne \`id\` a été ajoutée à auth.identities en 2024 (cloud Supabase).
  -- On la fournit systématiquement (gen_random_uuid) — sur les rares envs
  -- où elle n'existe pas, l'INSERT échouera proprement et le seed sera
  -- à relancer après upgrade GoTrue.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), p_user_id, p_user_id::text,
    jsonb_build_object('sub', p_user_id::text, 'email', p_email, 'email_verified', true),
    'email',
    now(), now(), now()
  )
  on conflict (provider, provider_id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (p_user_id, p_org_id, p_role, p_prenom, p_nom, p_email)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        prenom = excluded.prenom,
        nom = excluded.nom,
        email = excluded.email;
end
\$fn\$;

do \$\$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000010',
    'dirigeant@demo.tap', 'demo1234!',
    org_id, 'dirigeant', 'Patrick', 'Hoarau'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000020',
    'regulateur@demo.tap', 'demo1234!',
    org_id, 'regulateur', 'Sandrine', 'Payet'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000030',
    'chauffeur@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Jean-Marc', 'Técher'
  );
  -- Compte E2E (PLAN-1 helper loginAsRegulateur attend reg-demo@tap.test)
  perform pg_temp.seed_demo_user(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'reg-demo@tap.test', 'demo1234!',
    org_id, 'regulateur', 'E2E', 'Régulatrice'
  );
end
\$\$;

-- ─── seed.demo.sql ───────────────────────────────────────────────────

-- =============================================================================
-- Seed démo additionnel — Données réalistes 974 (preview / staging UNIQUEMENT)
-- =============================================================================
-- Applique APRÈS supabase/seed.sql. Ne contient AUCUNE donnée réelle :
--   • Noms réunionnais courants mais sans lien réel (Hoarau, Payet, Grondin,
--     Boyer, Dijoux, Maillot, Lebon, Robert, Vergoz, Bègue)
--   • NIRs fictifs avec clé de contrôle Luhn correcte (algorithme \`97 - n mod 97\`)
--   • Adresses de communes 974 (Saint-Denis, Saint-Pierre, Le Tampon, etc.)
--   • Téléphones format La Réunion (0262 fixe / 0692 mobile) NON attribués
--
-- À NE JAMAIS appliquer en production commerciale (RGPD : aucune donnée patient
-- réelle ne doit être co-localisée avec le seed démo).
--
-- Pour ne charger ce seed qu'en preview/staging :
--   psql "\$SUPABASE_DB_URL" -f supabase/seed.sql
--   psql "\$SUPABASE_DB_URL" -f supabase/seed.demo.sql   (preview/staging seulement)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10 patients fictifs réunionnais
-- -----------------------------------------------------------------------------
-- Helper inline : calcule la clé NIR Luhn (97 - (n mod 97)) pour un NIR sans clé
-- Format NIR Réunion : \`1AAMMddCCCNNN\` ou \`2AAMMddCCCNNN\` (13 chiffres) + clé 2 chiffres
-- où CCC = code commune (974xx pour La Réunion sur ce format simplifié de démo)
-- -----------------------------------------------------------------------------

do \$\$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  -- Edge Function NIR : on simule le chiffrement par null en seed démo
  -- (les fiches sans NIR sont valides ; affichage = \`••• ••• ••• ••• •••\`)
  -- Les NIRs réels seront ajoutés depuis l'UI une fois Edge Function configurée.
begin
  insert into public.patients (
    id, organization_id, prenom, nom, date_naissance, genre,
    telephone, telephone_normalized,
    adresse_ligne1, code_postal, ville,
    canal_contact_prefere, consentement_sms, consentement_sms_at,
    contact_urgence_nom, contact_urgence_telephone,
    nir_encrypted, nir_search_hash, nir_last4,
    archive, created_at, updated_at, created_by, updated_by
  ) values
    -- Saint-Denis — 4 patients
    ('11111111-0000-0000-0000-000000000001', org_id, 'Patrick', 'Hoarau',     '1958-03-15', 'M',
     '0692123456', '0692123456', '12 rue de la Source', '97400', 'Saint-Denis',
     'sms', true, now(), 'Marie Hoarau', '0692111111',
     null, null, '01 47',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000002', org_id, 'Marie-Ange', 'Payet',  '1962-08-22', 'F',
     '0262234567', '0262234567', '8 chemin Bellepierre', '97400', 'Saint-Denis',
     'appel', false, null, 'Joseph Payet', '0692222222',
     null, null, '02 89',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000003', org_id, 'Jean-Bernard', 'Grondin', '1945-12-03', 'M',
     '0692345678', '0692345678', '45 allée des Topazes', '97490', 'Sainte-Clotilde',
     'aucun', false, null, null, null,
     null, null, '14 23',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000004', org_id, 'Suzanne', 'Boyer',     '1970-05-18', 'F',
     '0262456789', '0262456789', '23 rue Montgaillard', '97400', 'Saint-Denis',
     'sms', true, now(), 'Anne Boyer', '0692333333',
     null, null, '06 12',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Pierre — 3 patients
    ('11111111-0000-0000-0000-000000000005', org_id, 'André', 'Dijoux',     '1955-09-30', 'M',
     '0692567890', '0692567890', '15 boulevard Lattre de Tassigny', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Henri Dijoux', '0692444444',
     null, null, '08 31',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000006', org_id, 'Marlène', 'Maillot',  '1968-02-14', 'F',
     '0262678901', '0262678901', '7 ravine des Cabris', '97432', 'Ravine des Cabris',
     'appel', false, null, null, null,
     null, null, '12 05',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000007', org_id, 'Bernard', 'Lebon',    '1949-07-08', 'M',
     '0692789012', '0692789012', '34 rue Caumont', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Lucie Lebon', '0692555555',
     null, null, '03 67',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Le Tampon — 2 patients
    ('11111111-0000-0000-0000-000000000008', org_id, 'Anne-Sophie', 'Robert', '1975-11-25', 'F',
     '0262890123', '0262890123', '67 14e Km', '97430', 'Le Tampon',
     'aucun', false, null, 'Marc Robert', '0692666666',
     null, null, '09 14',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000009', org_id, 'Yves', 'Vergoz',      '1953-04-19', 'M',
     '0692901234', '0692901234', '89 Bourg-Murat', '97418', 'La Plaine des Cafres',
     'sms', true, now(), null, null,
     null, null, '11 78',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Paul — 1 patient
    ('11111111-0000-0000-0000-000000000010', org_id, 'Christiane', 'Bègue', '1960-06-02', 'F',
     '0262012345', '0262012345', '5 rue Sainte-Anne', '97460', 'Saint-Paul',
     'appel', false, null, 'Philippe Bègue', '0692777777',
     null, null, '04 92',
     false, now(), now(), regulateur_id, regulateur_id)
  on conflict (id) do nothing;

  -- Quelques notes opérationnelles fictives
  insert into public.patient_operational_note (
    id, organization_id, patient_id, content, author_id, created_at
  ) values
    ('22222222-0000-0000-0000-000000000001', org_id,
     '11111111-0000-0000-0000-000000000001',
     'Code immeuble : 1234A. Préfère l''entrée arrière (escalier).',
     regulateur_id, now()),
    ('22222222-0000-0000-0000-000000000002', org_id,
     '11111111-0000-0000-0000-000000000003',
     'Sourd partiel — toujours sonner deux fois. Famille présente le matin.',
     regulateur_id, now()),
    ('22222222-0000-0000-0000-000000000005', org_id,
     '11111111-0000-0000-0000-000000000005',
     'Marche avec déambulateur. Prévoir aide à la montée véhicule.',
     regulateur_id, now())
  on conflict (id) do nothing;

  -- Quelques contraintes patient
  insert into public.patient_constraint (
    id, organization_id, patient_id, type, note, created_at, created_by
  ) values
    ('33333333-0000-0000-0000-000000000003', org_id,
     '11111111-0000-0000-0000-000000000003',
     'medical_fauteuil', 'Fauteuil pliant fourni par le patient',
     now(), regulateur_id),
    ('33333333-0000-0000-0000-000000000005', org_id,
     '11111111-0000-0000-0000-000000000005',
     'accompagnement_obligatoire', null,
     now(), regulateur_id),
    ('33333333-0000-0000-0000-000000000007', org_id,
     '11111111-0000-0000-0000-000000000007',
     'horaire_matin', 'Dialyse matin — départ 7h30 max',
     now(), regulateur_id),
    ('33333333-0000-0000-0000-000000000009', org_id,
     '11111111-0000-0000-0000-000000000009',
     'medical_oxygene', 'Bouteille O2 fournie par le patient',
     now(), regulateur_id)
  on conflict (id) do nothing;

  raise notice 'Seed démo : 10 patients fictifs créés (organization_id=%)', org_id;
end \$\$;

-- -----------------------------------------------------------------------------
-- Données futures (commentées tant que migrations Phase 4+ pas en place)
-- -----------------------------------------------------------------------------
-- TODO Phase 4 (récurrences) :
--   - 5 prescriptions actives (dialyse 3×/sem, chimio 1×/sem, kiné 2×/sem)
--   - 30 occurrences générées (rides) sur les 30 prochains jours
-- TODO Phase 6 (planning) :
--   - 200 rides historiques sur 60 derniers jours pour KPIs et démo cockpit
-- TODO Phase 9 (PWA chauffeur) :
--   - 6 chauffeurs avec credentials pour démo conformité (Phase 15)

-- ─── DONE ─────────────────────────────────────────────────────────────

select '✅ Setup terminé : migrations + seed appliqués' as status;
`;
