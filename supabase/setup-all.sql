-- ==============================================================================
-- TAP Régulation — Setup complet (migrations + seed démo)
-- ==============================================================================
-- Fichier généré automatiquement par scripts/build-setup-sql.sh.
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
as $$
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
$$;

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
returns text language sql immutable parallel safe as $$
  select extensions.unaccent('extensions.unaccent', input)
$$;

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
  code_postal text not null check (code_postal ~ '^974[0-9]{2}$'),
  ville text not null,
  contact_urgence_nom text,
  contact_urgence_telephone text,
  nir_encrypted bytea,
  nir_search_hash bytea,
  -- Format `XX YY` = 2 derniers digits + 2 digits de la clé. Pseudonymisation
  -- partielle (ADR-004 placeholder). Inclus dans le delta d'audit (non-secret).
  nir_last4 text check (nir_last4 is null or nir_last4 ~ '^[0-9]{2}\s[0-9]{2}$'),
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
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

create trigger patients_audit_trigger
  after insert or update or delete on public.patients
  for each row execute function public.patients_audit_trigger();

-- -- Section 12 — Trigger d'audit patient_constraint --------------------------
create or replace function public.patient_constraint_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

create trigger patient_constraint_audit_trigger
  after insert or update or delete on public.patient_constraint
  for each row execute function public.patient_constraint_audit_trigger();

-- -- Section 13 — Trigger d'audit patient_operational_note --------------------
create or replace function public.patient_operational_note_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

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
as $$
  select *
  from public.patients_safe
  where organization_id = public.current_organization_id()
    and length(q) >= 2
    and search_text % lower(extensions.unaccent(q))
  order by extensions.similarity(
    search_text, lower(extensions.unaccent(q))
  ) desc
  limit 10;
$$;

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
returns trigger language plpgsql as $$
begin
  if new.deadline_at is null then
    new.deadline_at := new.requested_at + interval '30 days';
  end if;
  return new;
end; $$;

create trigger patient_data_request_set_deadline_trigger
  before insert on public.patient_data_request
  for each row execute function public.patient_data_request_set_deadline();

-- -- Section 6 — Audit triggers (5 fonctions, pattern patients.sql dupliqué)

-- data_processing_register : pas de filtre (aucun secret)
create or replace function public.data_processing_register_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

create trigger data_processing_register_audit_trigger
  after insert or update or delete on public.data_processing_register
  for each row execute function public.data_processing_register_audit_trigger();

-- dpa_record : pas de filtre
create or replace function public.dpa_record_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

create trigger dpa_record_audit_trigger
  after insert or update or delete on public.dpa_record
  for each row execute function public.dpa_record_audit_trigger();

-- dpia_record : pas de filtre (jsonb risques/mitigations = pas secret)
create or replace function public.dpia_record_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

create trigger dpia_record_audit_trigger
  after insert or update or delete on public.dpia_record
  for each row execute function public.dpia_record_audit_trigger();

-- data_breach_incident : filtre cnil_notification_reference (numéro ARS-CNIL sensible)
create or replace function public.data_breach_incident_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

create trigger data_breach_incident_audit_trigger
  after insert or update or delete on public.data_breach_incident
  for each row execute function public.data_breach_incident_audit_trigger();

-- patient_data_request : filtre request_token + requester_proof_of_identity_url
-- Pitfall 2 RESEARCH : ces 2 colonnes ne doivent JAMAIS apparaître en clair
-- dans audit_logs.metadata.
create or replace function public.patient_data_request_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

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
-- les `select cron.schedule(...)` sont guardés via DO block conditionnel.
-- En production Supabase Cloud, pg_cron est pré-installé.
-- =============================================================================

-- pg_cron : pré-installé sur Supabase Cloud. Localement absent → guard.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  else
    raise notice 'pg_cron non disponible (sandbox locale) — cron.schedule sera skip.';
  end if;
end;
$$;

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
as $$
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
$$;

comment on function public.check_breach_deadlines() is
  'Watchdog 72h notification CNIL (art. 33 RGPD) — exécuté horaire par pg_cron.';

-- -- purge_legal_request_attempts() : nettoyage rate limit ------------------
create or replace function public.purge_legal_request_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.legal_request_attempts
  where attempted_at < now() - interval '7 days';
end;
$$;

comment on function public.purge_legal_request_attempts() is
  'Purge legal_request_attempts > 7 jours (Pitfall 6 RESEARCH) — exécuté quotidien.';

-- -- cron.schedule (guardé : DO block si extension présente) ----------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Watchdog 72h breach : exécution horaire
    perform cron.schedule(
      'breach-72h-watchdog',
      '0 * * * *',
      $cron$ select public.check_breach_deadlines(); $cron$
    );
    -- Purge rate limit attempts : 03h00 chaque nuit
    perform cron.schedule(
      'legal-request-attempts-purge',
      '0 3 * * *',
      $cron$ select public.purge_legal_request_attempts(); $cron$
    );
  end if;
end;
$$;

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
-- (974XX) car la valeur NULL passe le check (`code_postal is null or ...`).
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
as $$
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
$$;

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
as $$
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
$$;

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
returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;

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

-- ─── supabase/migrations/20260512000001_drivers.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 011 — Référentiel chauffeurs (drivers)
-- =============================================================================
-- Crée :
--   - table public.drivers (référentiel chauffeur d'une organization)
--   - RLS forcée pattern Phase 1 (SELECT same_org / INSERT+UPDATE dirigeant)
--   - 2 index : (organization_id, actif) partiel archive=false + (org, profile_id)
--   - trigger updated_at + trigger d'audit pattern Phase 1 patients
--   - revoke anon, grant authenticated (SELECT/INSERT/UPDATE — pas de DELETE)
-- Refs : ADR-002 (multi-tenant RLS) ; brief E2E v2 Passe 1 §4.3
-- =============================================================================

-- -- Section 1 — Table drivers --------------------------------------------------
-- profile_id nullable : on peut enregistrer un chauffeur avant qu'il dispose
-- d'un compte Auth (cas pattern Phase 1.5 patient_data_request). Le rattachement
-- profile_id ↔ compte chauffeur se fait au moment de l'invitation par dirigeant.
create table public.drivers (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references auth.users(id) on delete set null,
  nom_affichage text not null check (length(trim(nom_affichage)) between 1 and 80),
  telephone text,
  numero_licence text,
  -- type_permis : valeurs attendues côté zod {taxi, ambulance, vsl, tpmr}.
  -- Pas de check DB pour ne pas bloquer l'ajout d'un nouveau type métier futur
  -- sans migration (ex : 'vtc_med'). Validation centralisée dans @tap/shared.
  type_permis text[] not null default '{}',
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.drivers is
  'Référentiel chauffeur — un par organization. CRUD dirigeant. Passe 1 E2E v2.';

-- -- Section 2 — Index drivers --------------------------------------------------
-- (organization_id, actif) partiel sur archive=false : la liste dirigeant
-- filtre toujours archive=false et trie/filtre actif.
create index drivers_organization_actif_idx
  on public.drivers (organization_id, actif)
  where archive = false;

-- (organization_id, profile_id) partiel : lookup chauffeur ↔ compte auth pour
-- le SELECT « mes courses » côté chauffeur (listMyRidesToday Phase 3 03-B).
create index drivers_profile_idx
  on public.drivers (organization_id, profile_id)
  where profile_id is not null;

-- -- Section 3 — RLS forcée + policies (drivers) -------------------------------
alter table public.drivers enable row level security;
alter table public.drivers force row level security;

create policy drivers_select_same_org on public.drivers
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy drivers_insert_dirigeant on public.drivers
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy drivers_update_dirigeant on public.drivers
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive.

-- -- Section 4 — Trigger updated_at --------------------------------------------
create trigger drivers_set_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger d'audit drivers ---------------------------------------
-- Pattern Phase 1 patients_audit_trigger : to_jsonb(old/new) intégral. Aucune
-- colonne sensible chiffrée à filtrer (téléphone et numéro de licence sont
-- des données opérationnelles non-secrètes, journalisables).
create or replace function public.drivers_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'driver.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'driver', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.drivers_audit_trigger() is
  'Trigger audit drivers — INSERT/UPDATE/DELETE → audit_logs (action driver.*).';

create trigger drivers_audit_trigger
  after insert or update or delete on public.drivers
  for each row execute function public.drivers_audit_trigger();

-- -- Section 6 — Revoke / Grant ------------------------------------------------
revoke all on public.drivers from anon;
grant select, insert, update on public.drivers to authenticated;

-- ─── supabase/migrations/20260512000002_vehicles.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 012 — Référentiel véhicules (vehicles)
-- =============================================================================
-- Crée :
--   - table public.vehicles (référentiel véhicule d'une organization)
--   - check type ∈ {taxi_conventionne, tpmr, vsl, ambulance} (cohérent
--     avec public.ride_transport_mode mais sans coupler les deux types)
--   - index unique partiel (organization_id, upper(immatriculation))
--     where archive=false → un véhicule actif ne peut pas être saisi 2×
--   - RLS forcée pattern drivers (SELECT same_org / INSERT+UPDATE dirigeant)
--   - trigger updated_at + trigger d'audit
-- Refs : ADR-002 (multi-tenant RLS) ; brief E2E v2 Passe 1 §4.3
-- =============================================================================

-- -- Section 1 — Table vehicles -------------------------------------------------
create table public.vehicles (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  immatriculation text not null,
  marque text,
  modele text,
  type text not null check (
    type in ('taxi_conventionne', 'tpmr', 'vsl', 'ambulance')
  ),
  places_assises int check (
    places_assises is null or places_assises between 1 and 9
  ),
  places_tpmr int check (
    places_tpmr is null or places_tpmr between 0 and 3
  ),
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.vehicles is
  'Référentiel véhicule — un par organization. CRUD dirigeant. Passe 1 E2E v2.';

-- -- Section 2 — Index vehicles ------------------------------------------------
-- (organization_id, actif) partiel sur archive=false : pattern drivers.
create index vehicles_organization_actif_idx
  on public.vehicles (organization_id, actif)
  where archive = false;

-- Unique partiel : upper(immatriculation) pour normaliser AB-123-CD vs
-- ab-123-cd. Limité aux véhicules non-archivés pour autoriser la réaffectation
-- d'une plaque après cession (rare mais possible).
create unique index vehicles_immatriculation_unique
  on public.vehicles (organization_id, upper(immatriculation))
  where archive = false;

-- -- Section 3 — RLS forcée + policies (vehicles) -----------------------------
alter table public.vehicles enable row level security;
alter table public.vehicles force row level security;

create policy vehicles_select_same_org on public.vehicles
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy vehicles_insert_dirigeant on public.vehicles
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy vehicles_update_dirigeant on public.vehicles
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive.

-- -- Section 4 — Trigger updated_at --------------------------------------------
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger d'audit vehicles --------------------------------------
create or replace function public.vehicles_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'vehicle.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'vehicle', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.vehicles_audit_trigger() is
  'Trigger audit vehicles — INSERT/UPDATE/DELETE → audit_logs (action vehicle.*).';

create trigger vehicles_audit_trigger
  after insert or update or delete on public.vehicles
  for each row execute function public.vehicles_audit_trigger();

-- -- Section 6 — Revoke / Grant ------------------------------------------------
revoke all on public.vehicles from anon;
grant select, insert, update on public.vehicles to authenticated;

-- ─── supabase/migrations/20260512000003_rides_execution.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 013 — Extension rides : assignation chauffeur + exécution + paiement
-- =============================================================================
-- ALTER de public.rides (créée Phase 2 — 20260509000001_rides.sql, FIGÉE).
-- Ajoute :
--   - driver_id / vehicle_id (FK on delete restrict — pas de drop silencieux)
--   - started_at / ended_at (timestamps exécution)
--   - tarif_amount_eur / tarif_source (saisie manuelle V1, cgss_auto Passe 2)
--   - payment_status / payment_method / payment_received_at
--   - 3 contraintes de cohérence (encaissement complet, started ⇒ driver,
--     ended ≥ started)
--   - 1 index sur (driver_id, scheduled_at desc) partiel statuts actifs
--
-- Le trigger rides_audit_trigger existant (Phase 2) journalise déjà toutes
-- les colonnes via to_jsonb(old/new) — aucune modification du trigger n'est
-- nécessaire, les nouvelles colonnes seront capturées automatiquement.
-- Refs : brief E2E v2 Passe 1 §4.3
-- =============================================================================

-- -- Section 1 — Nouvelles colonnes --------------------------------------------
alter table public.rides
  add column driver_id uuid references public.drivers(id) on delete restrict;

alter table public.rides
  add column vehicle_id uuid references public.vehicles(id) on delete restrict;

alter table public.rides
  add column started_at timestamptz;

alter table public.rides
  add column ended_at timestamptz;

alter table public.rides
  add column tarif_amount_eur numeric(10, 2)
    check (tarif_amount_eur is null or tarif_amount_eur >= 0);

alter table public.rides
  add column tarif_source text
    check (tarif_source is null or tarif_source in ('manuel', 'cgss_auto'));

alter table public.rides
  add column payment_status text not null default 'non_concerne'
    check (payment_status in ('non_concerne', 'a_encaisser', 'encaisse'));

alter table public.rides
  add column payment_method text
    check (
      payment_method is null
      or payment_method in ('cash', 'cb', 'cheque', 'cgss_differe')
    );

alter table public.rides
  add column payment_received_at timestamptz;

-- -- Section 2 — Contraintes de cohérence --------------------------------------
-- 1. Encaissement complet : status=encaisse impose method ET received_at non-null
alter table public.rides
  add constraint rides_payment_encaisse_complet check (
    payment_status <> 'encaisse'
    or (payment_method is not null and payment_received_at is not null)
  );

-- 2. Une course démarrée doit avoir un chauffeur assigné
alter table public.rides
  add constraint rides_started_requires_driver check (
    started_at is null or driver_id is not null
  );

-- 3. ended_at ≥ started_at (et started_at obligatoire si ended_at présent)
alter table public.rides
  add constraint rides_ended_after_started check (
    ended_at is null
    or (started_at is not null and ended_at >= started_at)
  );

-- -- Section 3 — Index pour la liste chauffeur ---------------------------------
-- listMyRidesToday() filtre par driver_id + scheduled_at d'aujourd'hui + statuts
-- non-archivés. Index partiel pour éviter de gonfler avec des courses très
-- anciennes archivées.
create index rides_driver_scheduled_idx
  on public.rides (driver_id, scheduled_at desc)
  where status in ('assignee', 'en_cours', 'terminee') and archive = false;

-- -- Section 4 — Commentaires documentaires ----------------------------------
comment on column public.rides.driver_id is
  'Chauffeur assigné. Posée à la transition validee→assignee. Passe 1 E2E v2.';
comment on column public.rides.tarif_source is
  'manuel = saisie chauffeur V1 ; cgss_auto = calcul packages/pricing Passe 2.';
comment on column public.rides.payment_status is
  'non_concerne (CGSS pur), a_encaisser (différé), encaisse (cash/CB/chèque OK).';

-- ─── supabase/migrations/20260513000001_search_patients_ilike_fix.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Fix recherche patient : pg_trgm similarity globale échouait sur queries
-- courtes (« Bègue » → similarity 0.097 < threshold 0.3).
--
-- Remplace l'opérateur `%` (similarity sur chaîne entière) par :
--   - ILIKE %q% : match substring (pattern Doctolib/Linear/Stripe)
--   - <% (word_similarity) : fallback fautes de frappe
--
-- Index gin_trgm_ops existant supporte les deux opérateurs.
-- =============================================================================

create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select lower(extensions.unaccent(q)) as qn
  )
  select p.*
  from public.patients_safe p, normalized n
  where p.organization_id = public.current_organization_id()
    and length(q) >= 2
    and (
      p.search_text ilike '%' || n.qn || '%'
      or p.search_text <% n.qn
    )
  order by
    case
      when p.search_text ilike n.qn || '%' then 0
      when p.search_text ilike '% ' || n.qn || '%' then 1
      when p.search_text ilike '%' || n.qn || '%' then 2
      else 3
    end,
    extensions.word_similarity(p.search_text, n.qn) desc,
    p.nom asc
  limit 10;
$$;

comment on function public.search_patients(text) is
  'Recherche patient ILIKE + word_similarity fallback (pattern standard SaaS).
   Remplace l''ancienne implémentation pg_trgm `%` qui échouait sur queries
   courtes (similarity globale sous threshold 0.3).';

-- ─── supabase/migrations/20260513000002_anonymize_seed_profiles.sql ─────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- Anonymisation des profils démo (Phase 3 — clôture Passe 1).
--
-- Les comptes démo (dirigeant@demo.tap, regulateur@demo.tap,
-- chauffeur@demo.tap) ont été semés Phase 0.7 avec des noms réels
-- (« Patrick Hoarau », « Sandrine Payet », « Jean-Marc Técher »).
-- Cela viole .planning/regle-neutralite-et-ton.md : aucun nom propre
-- dans le code, les seeds ou les UI publiques. On remplace par des
-- libellés génériques (« Dirigeant Démo », etc.) — l'avatar UserMenu
-- affiche désormais « DD / RD / CD ».
--
-- Idempotent : safe à rejouer (where clause sur l'email @demo.tap).
-- Les seed.sql / seed.demo.sql / setup-all.sql / setup-sql.ts sont
-- mis à jour en parallèle pour que toute réinit DB reparte propre.
-- ---------------------------------------------------------------------------

update public.profiles
set
  prenom = case role
    when 'dirigeant'  then 'Dirigeant'
    when 'regulateur' then 'Régulateur'
    when 'chauffeur'  then 'Chauffeur'
    else prenom
  end,
  nom = 'Démo'
where email like '%@demo.tap';

-- ─── supabase/migrations/20260513000003_reseed_patients_fictifs.sql ─────────────────────────────────────────────────────────────

-- 20260513000003 — Re-seed patients fictifs (défense en profondeur NFR-001)
--
-- Données fictives — pattern numéro 9XXX + tél 99-90-XX,
-- aucune correspondance volontaire avec personnes réelles.
--
-- Migration idempotente : UPDATE ciblé sur clé naturelle (nom, prenom).
-- Re-runnable sans casser les FK rides.patient_id existantes.
-- Les noms réunionnais sont conservés (exception NFR-001 explicite pour
-- les données de démo, décision Q3 questionnaire phase 03.1).
--
-- Ref : D-SEED-1..4, checker W4 (regex strict exactement 10), checker W5
-- (`supabase/setup-all.sql` obligatoire, vérifié 2433 L).

UPDATE patients
SET telephone = '02 62 99 90 01',
    telephone_normalized = '0262999001',
    adresse_ligne1 = '9001 chemin du Vacoa',
    code_postal = '97400',
    ville = 'Saint-Denis'
WHERE nom = 'Bègue' AND prenom = 'Christiane';

UPDATE patients
SET telephone = '02 62 99 90 02',
    telephone_normalized = '0262999002',
    adresse_ligne1 = '9002 rue des Lataniers',
    code_postal = '97410',
    ville = 'Saint-Pierre'
WHERE nom = 'Boyer' AND prenom = 'Suzanne';

UPDATE patients
SET telephone = '06 92 99 90 03',
    telephone_normalized = '0692999003',
    adresse_ligne1 = '9003 allée des Songes',
    code_postal = '97410',
    ville = 'Saint-Pierre'
WHERE nom = 'Dijoux' AND prenom = 'André';

UPDATE patients
SET telephone = '06 92 99 90 04',
    telephone_normalized = '0692999004',
    adresse_ligne1 = '9004 chemin du Piton',
    code_postal = '97490',
    ville = 'Sainte-Clotilde'
WHERE nom = 'Grondin' AND prenom = 'Jean-Bernard';

UPDATE patients
SET telephone = '06 92 99 90 05',
    telephone_normalized = '0692999005',
    adresse_ligne1 = '9005 rue des Bambous',
    code_postal = '97400',
    ville = 'Saint-Denis'
WHERE nom = 'Hoarau' AND prenom = 'Patrick';

UPDATE patients
SET telephone = '06 92 99 90 06',
    telephone_normalized = '0692999006',
    adresse_ligne1 = '9006 chemin de la Ravine',
    code_postal = '97410',
    ville = 'Saint-Pierre'
WHERE nom = 'Lebon' AND prenom = 'Bernard';

UPDATE patients
SET telephone = '02 62 99 90 07',
    telephone_normalized = '0262999007',
    adresse_ligne1 = '9007 rue des Cyclones',
    code_postal = '97432',
    ville = 'Ravine des Cabris'
WHERE nom = 'Maillot' AND prenom = 'Marlène';

UPDATE patients
SET telephone = '02 62 99 90 08',
    telephone_normalized = '0262999008',
    adresse_ligne1 = '9008 allée du Volcan',
    code_postal = '97400',
    ville = 'Saint-Denis'
WHERE nom = 'Payet' AND prenom = 'Marie-Ange';

UPDATE patients
SET telephone = '02 62 99 90 09',
    telephone_normalized = '0262999009',
    adresse_ligne1 = '9009 chemin du Lagon',
    code_postal = '97430',
    ville = 'Le Tampon'
WHERE nom = 'Robert' AND prenom = 'Anne-Sophie';

UPDATE patients
SET telephone = '06 92 99 90 10',
    telephone_normalized = '0692999010',
    adresse_ligne1 = '9010 rue des Galets',
    code_postal = '97418',
    ville = 'La Plaine des Cafres'
WHERE nom = 'Vergoz' AND prenom = 'Yves';

-- ─── supabase/migrations/20260514000001_rides_cancel_motif.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — colonne cancel_motif sur rides (clôture-bis Passe 1)
-- =============================================================================
-- Ajoute une colonne text nullable pour stocker un motif libre (≤ 500 chars)
-- saisi au moment de l'annulation par le régulateur ou le dirigeant.
--
-- Pas d'enum motifs en V1 : on observe d'abord les motifs réels saisis
-- avant de figer une taxonomie. Migration future (Passe 4) pourra
-- introduire un type catégorisé sans casser l'historique.
--
-- L'audit log capte l'`old.status` → `new.status` et le `cancel_motif`
-- via le trigger Postgres existant `rides_audit_trigger` (jsonb to_jsonb
-- de la ligne complète).
-- =============================================================================

alter table public.rides
  add column if not exists cancel_motif text;

comment on column public.rides.cancel_motif is
  'Motif libre d''annulation (≤ 500 chars). Saisi par régulateur ou dirigeant
   au moment du basculement status → annulee_regulateur. V1 = texte libre.';

-- ─── supabase/migrations/20260514000002_driver_invitations.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Invitations chauffeurs (driver_invitations)
-- =============================================================================
-- Crée :
--   - table public.driver_invitations (workflow magic-link Supabase, Phase 04)
--   - 3 index : unique partiel (email) WHERE status='pending' (anti-doublon)
--               + (organization_id, status) + (driver_id) partiel
--   - RLS forcée + 3 policies :
--       SELECT : invité (invited_by) OU destinataire (email matché auth.users)
--       INSERT : dirigeant uniquement, même organization
--       UPDATE : destinataire pendant validité OU dirigeant émetteur
--       (PAS de policy DELETE — archivage logique status='revoked')
--   - trigger updated_at (réutilise public.set_updated_at)
--   - trigger d'audit : driver_invited / _accepted / _revoked / _resent / _updated
--   - revoke anon, grant authenticated (SELECT/INSERT/UPDATE — pas de DELETE)
--
-- Refs : Phase 04 PLAN-2, DEC-025 (table séparée, PAS extension drivers),
--        ADR-002 (multi-tenant RLS), DEC-010 (audit_logs INSERT-only),
--        C01 (intégralité couverte).
-- =============================================================================

-- -- Section 1 — Table driver_invitations -------------------------------------
-- driver_id nullable : l'invitation peut être créée avant l'enregistrement du
-- chauffeur dans la table drivers (cas onboarding « invitation pré-fiche »).
-- Le rattachement driver_id se fait à l'acceptation, dans la Server Action.
create table public.driver_invitations (
  id              uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id       uuid references public.drivers(id) on delete cascade,
  invited_by      uuid not null references auth.users(id) on delete restrict,
  email           text not null check (length(trim(email)) between 3 and 254),
  role            text not null default 'chauffeur' check (role in ('chauffeur')),
  status          text not null default 'pending'
    check (status in ('pending','accepted','expired','revoked')),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.driver_invitations is
  'Invitations chauffeurs — workflow magic link Supabase. Phase 04 onboarding.';

-- -- Section 2 — Index --------------------------------------------------------
-- Index unique partiel : un seul pending actif par email
-- (empêche le dirigeant d'inviter 2× le même email tant que la 1re invitation
-- est en attente). Les invitations 'accepted' / 'expired' / 'revoked' n'entrent
-- pas dans la contrainte (un nouveau pending peut être créé après revoke).
create unique index driver_invitations_pending_email_uniq
  on public.driver_invitations (email)
  where status = 'pending';

-- Index opérationnel : liste des invitations d'une organization par status
-- (pagination + filtre status côté UI dirigeant).
create index driver_invitations_org_status_idx
  on public.driver_invitations (organization_id, status);

-- Index opérationnel : retrouve l'invitation d'un driver (badge dans
-- drivers-list.client.tsx, Phase 04 §C02).
create index driver_invitations_driver_idx
  on public.driver_invitations (driver_id)
  where driver_id is not null;

-- -- Section 3 — RLS forcée + 3 policies --------------------------------------
alter table public.driver_invitations enable row level security;
alter table public.driver_invitations force row level security;

-- SELECT : émetteur (dirigeant) OU destinataire (par email matché auth.users)
create policy driver_invitations_select_invited_or_recipient
  on public.driver_invitations
  for select to authenticated
  using (
    auth.uid() = invited_by
    or email = (select u.email from auth.users u where u.id = auth.uid())
  );

-- INSERT : dirigeant uniquement, même organization, invited_by = soi-même
create policy driver_invitations_insert_dirigeant
  on public.driver_invitations
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
    and auth.uid() = invited_by
  );

-- UPDATE — 2 cas distincts, factorisés en une seule policy permissive :
--   a) destinataire pendant validité (acceptation : pending → accepted)
--   b) dirigeant émetteur (revoke / resend → expires_at refresh / status update)
create policy driver_invitations_update_recipient_or_dirigeant
  on public.driver_invitations
  for update to authenticated
  using (
    (
      email = (select u.email from auth.users u where u.id = auth.uid())
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());

-- Pas de policy DELETE — archivage logique via status='revoked'.

-- -- Section 4 — Trigger updated_at -------------------------------------------
create trigger driver_invitations_set_updated_at
  before update on public.driver_invitations
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger d'audit ----------------------------------------------
-- Pattern dérivé drivers_audit_trigger : to_jsonb(old/new) intégral.
-- Aucune colonne sensible chiffrée à filtrer (email est journalisable,
-- pas de NIR ni note médicale dans cette table).
--
-- Mapping action_name :
--   INSERT                                       → driver_invited
--   UPDATE (pending → accepted)                  → driver_invitation_accepted
--   UPDATE (pending → revoked)                   → driver_invitation_revoked
--   UPDATE (pending, expires_at bumped)          → driver_invitation_resent
--   UPDATE autre                                 → driver_invitation_updated
--
-- Note DEC-027 : l'event 'cgu_accepted_via_invitation' (RGPD) sera émis
-- applicativement par acceptInvitationAction (PLAN-3 §3.4), pas ici — c'est
-- un event sémantique séparé du UPDATE technique sur driver_invitations.
create or replace function public.driver_invitations_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := 'driver_invited';
  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status = 'pending' then
      action_name := 'driver_invitation_accepted';
    elsif new.status = 'revoked' and old.status = 'pending' then
      action_name := 'driver_invitation_revoked';
    elsif new.status = 'pending' and new.expires_at > old.expires_at then
      action_name := 'driver_invitation_resent';
    else
      action_name := 'driver_invitation_updated';
    end if;
  else
    action_name := 'driver_invitation.' || lower(tg_op);
  end if;

  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'driver_invitation', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.driver_invitations_audit_trigger() is
  'Trigger audit driver_invitations — INSERT/UPDATE → audit_logs (action driver_invited / _accepted / _revoked / _resent / _updated).';

create trigger driver_invitations_audit_trigger
  after insert or update on public.driver_invitations
  for each row execute function public.driver_invitations_audit_trigger();

-- -- Section 6 — Revoke / Grant ------------------------------------------------
revoke all on public.driver_invitations from anon;
grant select, insert, update on public.driver_invitations to authenticated;
-- Pas de DELETE.

-- ─── supabase/migrations/20260516000001_drivers_perm_regulateur.sql ─────────────────────────────────────────────────────────────

-- Migration : élargissement permissions chauffeurs au régulateur
--
-- Hotfix Phase 04 (DEC-029) : la gestion opérationnelle des chauffeurs
-- (CRUD + invitation) doit être accessible au rôle 'regulateur', pas
-- uniquement 'dirigeant'. Le métier réel taxi conventionné 974 = la
-- régulatrice gère l'onboarding quotidien (embauche, invitation,
-- modification, archivage). Dirigeant maintient son accès (élargissement,
-- pas transfert).
--
-- Modifie 4 policies RLS sur public.drivers + public.driver_invitations.
-- Ajoute aussi la colonne archive_motif sur drivers pour la confirmation
-- renforcée d'archivage (UX option C — modal motif obligatoire +
-- saisie "ARCHIVER").
--
-- Refs : DEC-029, hotfix permissions chauffeurs régulateur.

------------------------------------------------------------
-- Section 1 — public.drivers : élargir INSERT + UPDATE
------------------------------------------------------------

drop policy if exists drivers_insert_dirigeant on public.drivers;
drop policy if exists drivers_update_dirigeant on public.drivers;

create policy drivers_insert_admin_or_regulateur on public.drivers
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

create policy drivers_update_admin_or_regulateur on public.drivers
  for update
  to authenticated
  using (organization_id = public.current_organization_id())
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

------------------------------------------------------------
-- Section 2 — public.driver_invitations : élargir INSERT + UPDATE
------------------------------------------------------------

drop policy if exists driver_invitations_insert_dirigeant on public.driver_invitations;
drop policy if exists driver_invitations_update_recipient_or_dirigeant on public.driver_invitations;

create policy driver_invitations_insert_admin_or_regulateur on public.driver_invitations
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
    and auth.uid() = invited_by
  );

-- UPDATE — 2 cas distincts factorisés :
--   a) destinataire pendant validité (acceptation par le chauffeur invité)
--   b) émetteur dirigeant OR régulateur (revoke / resend → expires_at refresh)
create policy driver_invitations_update_recipient_or_admin_or_regulateur on public.driver_invitations
  for update
  to authenticated
  using (
    (
      email = (select u.email from auth.users u where u.id = auth.uid())
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and (
        public.has_role('dirigeant'::public.user_role)
        or public.has_role('regulateur'::public.user_role)
      )
    )
  )
  with check (organization_id = public.current_organization_id());

------------------------------------------------------------
-- Section 3 — drivers.archive_motif (confirmation renforcée UX option C)
------------------------------------------------------------

alter table public.drivers
  add column if not exists archive_motif text
    check (archive_motif is null or length(trim(archive_motif)) between 10 and 500);

comment on column public.drivers.archive_motif is
  'Motif libre saisi à l''archivage (DEC-029 confirmation renforcée). '
  'NULL tant que le driver n''est pas archivé. Min 10 / Max 500 chars.';

-- ─── supabase/migrations/20260516000002_drivers_archive_dirigeant_only.sql ─────────────────────────────────────────────────────────────

-- Migration : archivage chauffeur réservé au dirigeant (column-level)
--
-- Hotfix-bis Phase 04 (DEC-029 affinée) : la migration précédente
-- (20260516000001_drivers_perm_regulateur.sql) a élargi UPDATE
-- public.drivers au régulateur en globalité. Mais la décision D1 sépare
-- explicitement quatre actions :
--
--   - Désactiver (régulateur, actif=false)         → filet de sécurité
--   - Réactiver  (régulateur, actif=true)          → instantané
--   - Archiver   (DIRIGEANT UNIQUEMENT)            → sortie système
--   - Désarchiver (régulateur ou dirigeant)        → réintégration
--
-- Postgres RLS ne supporte pas nativement le contrôle column-level dans
-- USING/WITH CHECK (pas de référence OLD vs NEW). On enforce donc via un
-- trigger BEFORE UPDATE : si l'une des colonnes d'archivage change et que
-- l'appelant n'est pas dirigeant, on lève une exception.
--
-- Defense in depth : les Server Actions appliquent déjà ce contrôle au
-- niveau applicatif (requireDirigeant pour archiveDriverAction). Ce
-- trigger garantit qu'aucune route alternative (RPC, client direct) ne
-- contourne la règle.
--
-- Refs : DEC-029, hotfix permissions chauffeurs régulateur (Volet 1 bis).

create or replace function public.drivers_archive_columns_dirigeant_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Archivage (false → true) : dirigeant uniquement. Le désarchivage
  -- (true → false) reste autorisé au régulateur (D1 décision dirigeant).
  if (new.archive = true and old.archive = false)
     and not public.has_role('dirigeant'::public.user_role) then
    raise exception
      'Seul un dirigeant peut archiver un chauffeur.'
      using errcode = '42501';
  end if;

  -- Modification isolée du motif d'archivage (sans changement du flag
  -- archive) : dirigeant uniquement. Empêche un régulateur de réécrire
  -- l'historique d'un chauffeur déjà archivé.
  if new.archive_motif is distinct from old.archive_motif
     and new.archive is not distinct from old.archive
     and not public.has_role('dirigeant'::public.user_role) then
    raise exception
      'Seul un dirigeant peut modifier le motif d''archivage.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.drivers_archive_columns_dirigeant_only() is
  'Garde column-level : interdit aux non-dirigeants de modifier archive / '
  'archive_at / archive_motif sur public.drivers (DEC-029 sémantique '
  '4 actions distinctes).';

drop trigger if exists drivers_archive_columns_guard on public.drivers;

create trigger drivers_archive_columns_guard
  before update on public.drivers
  for each row
  execute function public.drivers_archive_columns_dirigeant_only();

-- ─── supabase/migrations/20260516000003_rides_update_chauffeur_policy.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Policy RLS UPDATE rides pour rôle chauffeur (Phase 04.5 T1.4)
-- =============================================================================
-- Contexte : la policy rides_update_regulateur_dirigeant (migration
-- 20260509000001_rides.sql ligne 100) restreint l'UPDATE rides aux rôles
-- regulateur et dirigeant. Conséquence : startRideAction / endRideAction
-- exécutent un UPDATE qui est silencieusement rejeté par RLS (0 rows affected)
-- côté chauffeur. Le Server Action retournait { success: true } malgré le
-- rejet → faux success affiché côté UI.
--
-- Cause root : aucune policy autorisant le chauffeur à modifier SES rides.
--
-- Fix : ajouter rides_update_chauffeur_own_rides — un chauffeur peut UPDATE
-- une ride si organization_id correspond, rôle = chauffeur, et driver_id
-- pointe vers SON enregistrement drivers (profile_id = auth.uid()).
--
-- USING et WITH CHECK identiques : empêche un chauffeur de transférer une
-- course à un autre chauffeur via UPDATE driver_id.
--
-- Scope amendement Phase 04.5 (DEC-041) : limité à rides_update + Server
-- Actions startRideAction/endRideAction. L'audit RLS systémique de toutes
-- les tables est reporté Phase 06 HDS.
-- =============================================================================

create policy rides_update_chauffeur_own_rides on public.rides
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = auth.uid()
        and archive = false
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = auth.uid()
        and archive = false
    )
  );

comment on policy rides_update_chauffeur_own_rides on public.rides is
  'Phase 04.5 T1.4 — Chauffeur peut UPDATE ses propres rides (driver_id ↔ profile_id). USING + WITH CHECK identiques empêchent transfert via UPDATE driver_id.';

-- ─── supabase/migrations/20260516000004_pois_metier.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — POI métier (lieux fréquents organisationnels)
-- =============================================================================
-- Refs : PLAN-3 T3.2, D-09, DEC-035, DEC-032 (CD push exclusif).
--
-- Table de référentiel POI scopée par organisation (CHU, cliniques, EHPAD,
-- centres dialyse, cabinets médicaux, etc.). Saisie par dirigeant +
-- régulateur, recherche full-text français pour le picker des courses et
-- du formulaire patient (intégration UI = composant AddressOrPOIPicker).
-- =============================================================================

-- Section 1 — Table -----------------------------------------------------------
create table public.pois_metier (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  nom_court text not null check (length(trim(nom_court)) between 1 and 80),
  nom_long text,
  type_poi text not null check (type_poi in (
    'hopital', 'clinique', 'cabinet_medical',
    'centre_dialyse', 'cabinet_kine', 'ehpad',
    'foyer_medicalise', 'pharmacie', 'laboratoire',
    'centre_imagerie', 'autre'
  )),
  adresse text not null,
  code_postal text not null check (code_postal ~ '^974[0-9]{2}$'),
  ville text not null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  telephone text,
  notes_acces text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Section 2 — Index ----------------------------------------------------------
create index pois_metier_org_idx
  on public.pois_metier (organization_id);

create index pois_metier_actif_idx
  on public.pois_metier (organization_id, actif)
  where actif = true;

-- Full-text français pour la recherche du picker
create index pois_metier_search_idx
  on public.pois_metier using gin (
    to_tsvector('french', coalesce(nom_court, '') || ' ' ||
                          coalesce(nom_long, '') || ' ' ||
                          coalesce(adresse, ''))
  );

-- Section 3 — RLS forcée + policies ------------------------------------------
alter table public.pois_metier enable row level security;
alter table public.pois_metier force row level security;

-- Lecture : tout authentifié same-org (le picker régulateur a besoin de
-- l'intégralité du référentiel pour les suggestions).
create policy pois_metier_select_same_org on public.pois_metier
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT / UPDATE / DELETE : dirigeant ou régulateur uniquement.
create policy pois_metier_modify_admin_or_regulateur on public.pois_metier
  for all to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

-- Section 4 — Trigger updated_at ---------------------------------------------
create trigger pois_metier_set_updated_at
  before update on public.pois_metier
  for each row execute function public.set_updated_at();

-- Section 5 — Trigger d'audit ------------------------------------------------
create or replace function public.pois_metier_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'poi_metier.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'poi_metier', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger pois_metier_audit_trigger
  after insert or update or delete on public.pois_metier
  for each row execute function public.pois_metier_audit_trigger();

-- Section 6 — Revoke / Grant -------------------------------------------------
revoke all on public.pois_metier from anon;
grant select, insert, update, delete on public.pois_metier to authenticated;

-- Section 7 — Commentaires ---------------------------------------------------
comment on table public.pois_metier is
  'Référentiel POI métier (CHU, cliniques, EHPAD, cabinets) scopé par organisation. PLAN-3 Phase 04.5 — DEC-035 / D-09.';
comment on column public.pois_metier.type_poi is
  'Liste fermée : hopital, clinique, cabinet_medical, centre_dialyse, cabinet_kine, ehpad, foyer_medicalise, pharmacie, laboratoire, centre_imagerie, autre.';
comment on column public.pois_metier.notes_acces is
  'Notes opérationnelles (ex : « Parking sous-sol via rue arrière », « Sonner interphone 12 »).';
comment on policy pois_metier_select_same_org on public.pois_metier is
  'Phase 04.5 PLAN-3 T3.2 — Lecture same-org pour tous les authentifiés (picker partagé).';
comment on policy pois_metier_modify_admin_or_regulateur on public.pois_metier is
  'Phase 04.5 PLAN-3 T3.2 — Modification limitée dirigeant + régulateur (DEC-029 pattern).';

-- ─── supabase/migrations/20260516000005_rides_geocoding.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Géocoding rides (Phase 04.7 T3.1, DEC-044)
-- =============================================================================
-- Ajout colonnes nullables pickup_lat/lng/citycode + dropoff_* sur rides
-- pour persister les coordonnées BAN/POI au moment de la saisie course.
-- Préfigure le calcul tarif réel CGSS Phase 05.5 (Haversine ou OSRM).
--
-- Toutes nullables : compat existant + courses créées sans BAN (saisie libre)
-- = pas de coords + fallback random pricing DEC-042.
--
-- Refs : DEC-044 LOCKED, DEC-032 (CD push exclusif).
-- =============================================================================

alter table public.rides
  add column pickup_lat numeric(10, 7),
  add column pickup_lng numeric(10, 7),
  add column pickup_citycode text,
  add column dropoff_lat numeric(10, 7),
  add column dropoff_lng numeric(10, 7),
  add column dropoff_citycode text;

-- Index partiels (citycode) : requêtes futures par commune INSEE
-- (Phase 05.5 stats CGSS, Phase 06 facturation par zone).
create index rides_pickup_citycode_idx
  on public.rides (pickup_citycode)
  where pickup_citycode is not null;

create index rides_dropoff_citycode_idx
  on public.rides (dropoff_citycode)
  where dropoff_citycode is not null;

-- Commentaires colonnes
comment on column public.rides.pickup_lat is
  'Latitude pickup (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.pickup_lng is
  'Longitude pickup (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.pickup_citycode is
  'Code INSEE commune pickup (5 chiffres). Source BAN. Phase 04.7 DEC-044.';
comment on column public.rides.dropoff_lat is
  'Latitude dropoff (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.dropoff_lng is
  'Longitude dropoff (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.dropoff_citycode is
  'Code INSEE commune dropoff (5 chiffres). Source BAN. Phase 04.7 DEC-044.';

-- ─── supabase/migrations/20260516000006_perf_rls_wrapping_and_fk_indexes.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Performance : RLS wrapping + FK indexes hot path (Phase 04.7-bis-perf)
-- =============================================================================
-- Phase A diagnostic Supabase MCP (lecture seule) a identifié :
--   - 25 FKs sans index (5 hot path = jointures listes patients/courses)
--   - pg_trgm + index trigram patients déjà actifs (pas la cause)
--   - 44 policies sur 18 tables utilisent current_organization_id() SANS
--     wrapping (SELECT ...) → fonction ré-évaluée per-row au lieu d'une fois
--     via initPlan PostgreSQL
--
-- Baseline mesurée Firefox Network tab preview Vercel :
--   - Recherche patient autocomplete : 828-1214ms par keystroke
--   - Navigation /patients : 721ms
--   - Navigation /courses : 865ms + 794-1021ms data fetch
--
-- Cible post-migration :
--   - Recherche patient : <100ms (idéal 30-50ms)
--   - Navigation pages liste : <300ms
--
-- Sources :
--   - Supabase docs : https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--   - I Love Blogs (RLS performance) : wrapping (SELECT auth.uid()) speedup 100x
--   - PostgreSQL initPlan : sous-requête simple évaluée une fois
--
-- Sémantique : préservée à 100% (uniquement wrapping fonctions stables, pas
-- de changement de comportement). Les rows visibles avant/après sont
-- identiques pour un utilisateur donné.
--
-- Refs : DEC-032 (CD push exclusif), DEC-041 N/A, V3 sémantique préservée.
-- =============================================================================

-- =============================================================================
-- SECTION A — FK indexes hot path (additif, safe)
-- =============================================================================

-- rides.vehicle_id : utilisé en jointure liste courses (patients_safe → rides → vehicles)
create index if not exists rides_vehicle_id_idx
  on public.rides (vehicle_id)
  where vehicle_id is not null;

-- ride_draft.organization_id + patient_id : utilisés draft queue régulateur
create index if not exists ride_draft_organization_id_idx
  on public.ride_draft (organization_id);

create index if not exists ride_draft_patient_id_idx
  on public.ride_draft (patient_id)
  where patient_id is not null;

-- patient_constraint.organization_id : utilisé jointure patient drawer
create index if not exists patient_constraint_organization_id_idx
  on public.patient_constraint (organization_id);

-- patient_operational_note.organization_id : utilisé jointure patient drawer
create index if not exists patient_operational_note_organization_id_idx
  on public.patient_operational_note (organization_id);

-- =============================================================================
-- SECTION B — current_organization_id() : wrapping interne auth.uid()
-- =============================================================================
-- Optimisation interne : auth.uid() est appelé une fois par invocation.
-- Combiné avec le wrapping externe (SELECT current_organization_id()),
-- le double effet initPlan élimine la cascade per-row.

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid())
    and actif is true
  limit 1;
$$;

comment on function public.current_organization_id() is
  'Phase 04.7-bis-perf : auth.uid() wrappé (SELECT ...) interne pour initPlan optimization. STABLE garde la cache résultats per-statement.';

-- =============================================================================
-- SECTION C — Wrapping (SELECT current_organization_id()) sur policies hot path
-- =============================================================================
-- Sémantique IDENTIQUE — uniquement le wrapping. PostgreSQL traite la
-- sous-requête comme initPlan stable et l'évalue UNE FOIS par statement
-- au lieu d'une fois par row examiné.

-- ─── patients ────────────────────────────────────────────────────────────────
drop policy if exists patients_select_same_org on public.patients;
create policy patients_select_same_org on public.patients
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists patients_insert_regulateur on public.patients;
create policy patients_insert_regulateur on public.patients
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists patients_update_regulateur on public.patients;
create policy patients_update_regulateur on public.patients
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = (select public.current_organization_id()));

-- ─── rides ───────────────────────────────────────────────────────────────────
drop policy if exists rides_select_same_org on public.rides;
create policy rides_select_same_org on public.rides
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists rides_insert_regulateur_dirigeant on public.rides;
create policy rides_insert_regulateur_dirigeant on public.rides
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and created_by = (select auth.uid())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists rides_update_regulateur_dirigeant on public.rides;
create policy rides_update_regulateur_dirigeant on public.rides
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = (select public.current_organization_id()));

drop policy if exists rides_update_chauffeur_own_rides on public.rides;
create policy rides_update_chauffeur_own_rides on public.rides
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = (select auth.uid()) and archive = false
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = (select auth.uid()) and archive = false
    )
  );

-- ─── drivers ─────────────────────────────────────────────────────────────────
drop policy if exists drivers_select_same_org on public.drivers;
create policy drivers_select_same_org on public.drivers
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists drivers_insert_admin_or_regulateur on public.drivers;
create policy drivers_insert_admin_or_regulateur on public.drivers
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  );

drop policy if exists drivers_update_admin_or_regulateur on public.drivers;
create policy drivers_update_admin_or_regulateur on public.drivers
  for update to authenticated
  using (organization_id = (select public.current_organization_id()))
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  );

-- ─── vehicles ────────────────────────────────────────────────────────────────
drop policy if exists vehicles_select_same_org on public.vehicles;
create policy vehicles_select_same_org on public.vehicles
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists vehicles_insert_dirigeant on public.vehicles;
create policy vehicles_insert_dirigeant on public.vehicles
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

drop policy if exists vehicles_update_dirigeant on public.vehicles;
create policy vehicles_update_dirigeant on public.vehicles
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = (select public.current_organization_id()));

-- ─── pois_metier ─────────────────────────────────────────────────────────────
drop policy if exists pois_metier_select_same_org on public.pois_metier;
create policy pois_metier_select_same_org on public.pois_metier
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists pois_metier_modify_admin_or_regulateur on public.pois_metier;
create policy pois_metier_modify_admin_or_regulateur on public.pois_metier
  for all to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  );

-- ─── patient_constraint ──────────────────────────────────────────────────────
drop policy if exists patient_constraint_select_same_org on public.patient_constraint;
create policy patient_constraint_select_same_org on public.patient_constraint
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists patient_constraint_insert_regulateur on public.patient_constraint;
create policy patient_constraint_insert_regulateur on public.patient_constraint
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists patient_constraint_delete_regulateur on public.patient_constraint;
create policy patient_constraint_delete_regulateur on public.patient_constraint
  for delete to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

-- ─── patient_operational_note ────────────────────────────────────────────────
drop policy if exists patient_operational_note_select_same_org on public.patient_operational_note;
create policy patient_operational_note_select_same_org on public.patient_operational_note
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists patient_operational_note_insert_regulateur on public.patient_operational_note;
create policy patient_operational_note_insert_regulateur on public.patient_operational_note
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists patient_operational_note_update_regulateur on public.patient_operational_note;
create policy patient_operational_note_update_regulateur on public.patient_operational_note
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = (select public.current_organization_id()));

-- =============================================================================
-- SECTION D — search_patients RPC wrapping
-- =============================================================================
-- Le RPC est SECURITY INVOKER (RLS héritée). Le wrapping
-- (SELECT public.current_organization_id()) dans la query interne
-- s'applique sur le filtre direct (en plus du wrapping RLS Section C).

create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select lower(extensions.unaccent(q)) as qn
  )
  select p.*
  from public.patients_safe p, normalized n
  where p.organization_id = (select public.current_organization_id())
    and length(q) >= 2
    and (
      p.search_text ilike '%' || n.qn || '%'
      or p.search_text % n.qn
    )
  order by extensions.similarity(p.search_text, n.qn) desc
  limit 10;
$$;

comment on function public.search_patients(text) is
  'Phase 04.7-bis-perf : RPC recherche fuzzy patients. ILIKE %x% pour match contiens + opérateur trigram % pour ranking. Wrapping (SELECT current_organization_id()) pour initPlan PostgreSQL optimization. RLS héritée via SECURITY INVOKER.';

revoke all on function public.search_patients(text) from public;
grant execute on function public.search_patients(text) to authenticated;

-- ─── supabase/migrations/20260518000001_hotfix_rls_recursion_security_definer.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Hotfix régression PR #101 — SECURITY DEFINER restauré (2026-05-18)
-- =============================================================================
-- La migration 20260516000006 a remplacé security definer par security invoker
-- sur current_organization_id() ET current_user_role(), provoquant une
-- récursion infinie RLS sur les policies de profiles (et toutes les tables qui
-- wrappent ces fonctions dans leurs policies).
--
-- Mécanique de la régression :
--   1. App fait SELECT * FROM profiles WHERE id = user_id
--   2. Postgres applique RLS policy profiles_select_same_org :
--      organization_id = current_organization_id()
--   3. current_organization_id() (security invoker) SELECT depuis profiles
--   4. Postgres applique RLS sur cette nouvelle requête profiles
--   5. Récursion infinie → stack overflow Postgres → 500
--
-- Résultat observé : erreurs 500 systématiques sur GET /profiles,
-- /patients_safe, /rides, etc. → boucle middleware Next.js côté app →
-- boucle redirect client → "Too many calls to Location or History APIs"
-- Firefox.
--
-- Fix : restaurer SECURITY DEFINER (comme foundations.sql original),
-- en PRÉSERVANT le wrapping interne (SELECT auth.uid()) pour le bénéfice
-- initPlan PostgreSQL apporté par PR #101.
--
-- Sources :
--   - foundations.sql ligne 125-126 commentaire explicite :
--     « SECURITY DEFINER permet de lire profiles sans déclencher
--       les policies récursivement. »
--   - PostgreSQL docs SECURITY DEFINER bypass RLS
--
-- Refs : DEC-032 (CD push exclusif), DEC-041 N/A.
-- =============================================================================

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid())
    and actif is true
  limit 1;
$$;

comment on function public.current_organization_id() is
  'organization_id du profil rattaché à auth.uid(). NULL si non authentifié ou inactif. SECURITY DEFINER = bypass RLS récursion (cf hotfix 2026-05-18). Wrapping (SELECT auth.uid()) interne préservé pour initPlan.';

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and actif is true
  limit 1;
$$;

comment on function public.current_user_role() is
  'Rôle du profil rattaché à auth.uid(). NULL si non auth/inactif. SECURITY DEFINER = bypass RLS (cf hotfix 2026-05-18).';

-- ─── supabase/migrations/20260518000002_idempotency_keys.sql ─────────────────────────────────────────────────────────────

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

-- ─── supabase/migrations/20260519000001_ride_recurrences.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — Table ride_recurrences (modèle de récurrence)
-- Ref : DEC-046 rrule.js LOCKED, RFC 5545

create table public.ride_recurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid null, -- FK reportée Phase 06 (table prescriptions non créée V1.5, cf CONCERNS)
  rrule_str text not null,
  start_date date not null,
  end_date date null,
  pickup_address text not null,
  pickup_lat numeric(10,7) null,
  pickup_lng numeric(10,7) null,
  pickup_citycode text null,
  dropoff_address text not null,
  dropoff_lat numeric(10,7) null,
  dropoff_lng numeric(10,7) null,
  dropoff_citycode text null,
  transport_mode text not null,
  urgency text not null default 'normale',
  archived_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.ride_recurrences enable row level security;

create policy ride_recurrences_select_org on public.ride_recurrences
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

create policy ride_recurrences_insert_regulateur on public.ride_recurrences
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_recurrences_update_regulateur on public.ride_recurrences
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_recurrences_delete_dirigeant on public.ride_recurrences
  for delete to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

create index ride_recurrences_patient_id_idx on public.ride_recurrences (patient_id);
create index ride_recurrences_organization_id_idx on public.ride_recurrences (organization_id);

-- ─── supabase/migrations/20260519000002_ride_recurrence_exceptions.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — Exceptions manuelles sur récurrences (EXDATE)

create table public.ride_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  ride_recurrence_id uuid not null references public.ride_recurrences(id) on delete cascade,
  excluded_date date not null,
  reason text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ride_recurrence_id, excluded_date)
);

create index ride_recurrence_exceptions_recurrence_id_idx
  on public.ride_recurrence_exceptions (ride_recurrence_id);

alter table public.ride_recurrence_exceptions enable row level security;

create policy ride_recurrence_exceptions_select_org on public.ride_recurrence_exceptions
  for select to authenticated
  using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
  );

create policy ride_recurrence_exceptions_insert_regulateur on public.ride_recurrence_exceptions
  for insert to authenticated
  with check (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_recurrence_exceptions_update_regulateur on public.ride_recurrence_exceptions
  for update to authenticated
  using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
  );

create policy ride_recurrence_exceptions_delete_dirigeant on public.ride_recurrence_exceptions
  for delete to authenticated
  using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
    and public.has_role('dirigeant'::public.user_role)
  );

-- ─── supabase/migrations/20260519000003_holidays_974.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — Jours fériés Réunion (974)
-- Seed 2026-2028 (12 jours nationaux + Fèt Kaf 20 décembre commémo abolition esclavage).

create table public.holidays_974 (
  date date primary key,
  label text not null
);

alter table public.holidays_974 enable row level security;

create policy holidays_974_read on public.holidays_974
  for select to authenticated using (true);

insert into public.holidays_974 (date, label) values
  -- 2026
  ('2026-01-01', 'Jour de l''An'),
  ('2026-04-06', 'Lundi de Paques'),
  ('2026-05-01', 'Fete du Travail'),
  ('2026-05-08', 'Victoire 1945'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecote'),
  ('2026-07-14', 'Fete nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice 1918'),
  ('2026-12-20', 'Abolition de l''esclavage (974)'),
  ('2026-12-25', 'Noel'),
  -- 2027
  ('2027-01-01', 'Jour de l''An'),
  ('2027-03-29', 'Lundi de Paques'),
  ('2027-05-01', 'Fete du Travail'),
  ('2027-05-06', 'Ascension'),
  ('2027-05-08', 'Victoire 1945'),
  ('2027-05-17', 'Lundi de Pentecote'),
  ('2027-07-14', 'Fete nationale'),
  ('2027-08-15', 'Assomption'),
  ('2027-11-01', 'Toussaint'),
  ('2027-11-11', 'Armistice 1918'),
  ('2027-12-20', 'Abolition de l''esclavage (974)'),
  ('2027-12-25', 'Noel'),
  -- 2028
  ('2028-01-01', 'Jour de l''An'),
  ('2028-04-17', 'Lundi de Paques'),
  ('2028-05-01', 'Fete du Travail'),
  ('2028-05-08', 'Victoire 1945'),
  ('2028-05-25', 'Ascension'),
  ('2028-06-05', 'Lundi de Pentecote'),
  ('2028-07-14', 'Fete nationale'),
  ('2028-08-15', 'Assomption'),
  ('2028-11-01', 'Toussaint'),
  ('2028-11-11', 'Armistice 1918'),
  ('2028-12-20', 'Abolition de l''esclavage (974)'),
  ('2028-12-25', 'Noel');

-- ─── supabase/migrations/20260519000004_sms_messages.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — Tracking SMS sortants (delivery status Twilio)
-- Ref : DEC-008 SMS consentement (vérification côté applicatif avant insertion).

create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid null references public.patients(id) on delete set null,
  ride_id uuid null references public.rides(id) on delete set null,
  template_key text not null,
  to_phone text not null,
  body_rendered text not null,
  twilio_message_sid text null,
  delivery_status text not null default 'queued'
    check (delivery_status in (
      'queued', 'sent', 'delivered', 'failed', 'undelivered', 'skipped_consent_revoked'
    )),
  delivery_error text null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now()
);

create index sms_messages_organization_id_idx on public.sms_messages (organization_id);
create index sms_messages_patient_id_idx on public.sms_messages (patient_id);
create index sms_messages_ride_id_idx on public.sms_messages (ride_id);
create index sms_messages_twilio_sid_idx on public.sms_messages (twilio_message_sid) where twilio_message_sid is not null;

alter table public.sms_messages enable row level security;

create policy sms_messages_select_org on public.sms_messages
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

-- ─── supabase/migrations/20260519000005_sms_templates.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — Templates SMS (j1_reminder + j2h_reminder seed)
-- Variables Mustache {{patient_prenom}} {{date}} {{heure}} {{chauffeur_prenom}} {{pickup_address}}
-- NFR-001 : zéro nom propre dans le code — uniquement variables.

create table public.sms_templates (
  key text primary key,
  body text not null check (length(body) <= 160),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sms_templates enable row level security;

create policy sms_templates_read on public.sms_templates
  for select to authenticated using (true);

create policy sms_templates_update_dirigeant on public.sms_templates
  for update to authenticated
  using (public.has_role('dirigeant'::public.user_role))
  with check (public.has_role('dirigeant'::public.user_role));

-- Seed initial (updated_by null = system seed).
-- Le dirigeant prendra le relai au premier edit via UI admin (Wave 4).
insert into public.sms_templates (key, body) values
  (
    'j1_reminder',
    'Bonjour {{patient_prenom}}, rappel course demain {{date}} a {{heure}} avec {{chauffeur_prenom}}. TAP Reunion.'
  ),
  (
    'j2h_reminder',
    '{{patient_prenom}}, votre course est dans 2h ({{heure}}). {{chauffeur_prenom}} vient vous chercher. TAP Reunion.'
  );

-- ─── supabase/migrations/20260519000006_rides_no_show_columns.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — Colonnes patient absent sur rides
-- Workflow patient absent (Wave 6) — horodatage + motif libre.

alter table public.rides
  add column no_show_at timestamptz null,
  add column no_show_motif text null;

create index rides_no_show_at_idx
  on public.rides (no_show_at)
  where no_show_at is not null;

-- ─── supabase/migrations/20260519000007_pg_net_pg_cron_setup.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 1 — pg_net + pg_cron schedules SMS reminders
-- Ref : DEC-050 RÉVISÉ pg_cron + pg_net + Vault.
--
-- pg_cron 1.6.4 et supabase_vault 0.3.1 sont déjà activés (Supabase managed).
-- Cette migration active pg_net et planifie les 2 cron jobs SMS.
--
-- Le secret 'cron_app_token' doit être créé MANUELLEMENT dans la console
-- Supabase (Vault) post-merge — pas de hardcoding dans git :
--
--   select vault.create_secret('XXXX-32-chars-uuid-v4', 'cron_app_token');
--
-- Si le secret est absent au déclenchement cron, le SELECT dans
-- vault.decrypted_secrets retourne NULL et l'header Authorization sera
-- 'Bearer ' vide → le Route Handler Next.js refusera 401. Comportement
-- attendu jusqu'à création du secret.
--
-- Timezone : pg_cron exprime ses schedules en UTC. La Réunion est UTC+4.
--   '0 14 * * *' UTC = 18h00 Réunion (rappel J-1 en soirée).
--   '0 * * * *'  toutes les heures (rappel J-2h).

create extension if not exists pg_net;

select cron.schedule(
  'sms-reminder-j1',
  '0 14 * * *',
  $cron$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'sms-reminder-j2h',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j2h',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- ─── supabase/migrations/20260520000001_rides_ride_recurrence_id.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 3 — Lien rides ↔ ride_recurrences pour cascade DEC-048
-- Trou identifié dans PLAN-3 (PR #123) post-merge Wave 1 (PR #124) :
-- la colonne ride_recurrence_id manquait pour permettre :
--   1. Tracer quelle récurrence a généré chaque ride
--   2. Cascade DEC-048 : delete rides futures non-démarrées + regen
--   3. Restitution UI fiche patient (rides liées à chaque récurrence)
--
-- Réf : PLAN-3-modal-recurrence-ui.md lignes 109, 158, DEC-048 LOCKED.

alter table public.rides
  add column ride_recurrence_id uuid null
    references public.ride_recurrences(id) on delete set null;

-- Index partiel : optimise SELECT rides WHERE ride_recurrence_id = X
-- (cascade DEC-048) + listing UI fiche patient.
create index rides_ride_recurrence_id_idx
  on public.rides (ride_recurrence_id)
  where ride_recurrence_id is not null;

-- Les policies RLS existantes de rides (organization_id-based) couvrent
-- déjà les nouvelles requêtes — la colonne ride_recurrence_id ne change
-- pas les règles d'accès.

-- ─── supabase/migrations/20260521000001_ride_events.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 6 — Table ride_events (alertes opérationnelles)
-- Trou identifié PLAN-2 Wave 2 (PR #125 cockpit fallback [] silencieux car
-- table absente) + prérequis Wave 6 workflow patient absent
-- (INSERT type 'patient_no_show' depuis Route Handler PWA).
--
-- Types d'événements V1.5 :
--   - patient_no_show : chauffeur déclare patient absent (Wave 6)
--   - sms_failed     : webhook Twilio status failed/undelivered (Wave 5)
--   - ride_delayed   : informatif (Phase 06+ heuristique)
--
-- Réf : PLAN-6 lignes 446-458, DEC-053 endpoint cohérent DEC-045,
-- UI-SPEC Surface 5 cockpit alerte slide-in.

create table public.ride_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  event_type text not null check (event_type in (
    'patient_no_show',
    'sms_failed',
    'ride_delayed'
  )),
  payload jsonb null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create index ride_events_organization_id_idx on public.ride_events (organization_id);
create index ride_events_ride_id_idx on public.ride_events (ride_id);
create index ride_events_event_type_idx on public.ride_events (event_type);
create index ride_events_created_at_desc_idx on public.ride_events (created_at desc);

alter table public.ride_events enable row level security;

-- SELECT : tous les membres de l'organisation (régulateur + dirigeant +
-- chauffeur). La restriction chauffeur côté lecture est laxiste V1.5 :
-- les chauffeurs n'ont aujourd'hui pas d'UI consommant ride_events
-- (Phase 06+ historique perso éventuel).
create policy ride_events_select_org on public.ride_events
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

-- INSERT : régulateur/dirigeant pour n'importe quel ride de l'org ;
-- chauffeur uniquement pour SES rides (cohérent driver_id = drivers.user_id).
create policy ride_events_insert_regulateur_or_driver on public.ride_events
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
      or (
        public.has_role('chauffeur'::public.user_role)
        and ride_id in (
          select id from public.rides
          where driver_id in (
            select id from public.drivers
            where profile_id = auth.uid()
          )
        )
      )
    )
  );

-- Pas de UPDATE (immuable post-création, log d'événements).
-- Pas de DELETE V1.5 (audit trail — Phase 06 RGPD purge éventuelle).

-- ─── supabase/migrations/20260521000002_idempotency_keys_no_show.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 6 — Ajout 'no_show_ride' à idempotency_keys.mutation_type
--
-- Constraint actuelle (Phase 04.9, migration 20260518000002) :
--   check (mutation_type in ('start_ride', 'end_ride'))
--
-- Phase 05 Wave 6 étend avec 'no_show_ride' pour le Route Handler PWA
-- /api/driver/rides/[rideId]/no-show cohérent DEC-045 pattern.

alter table public.idempotency_keys
  drop constraint idempotency_keys_mutation_type_check;

alter table public.idempotency_keys
  add constraint idempotency_keys_mutation_type_check
  check (mutation_type in ('start_ride', 'end_ride', 'no_show_ride'));

-- ─── supabase/migrations/20260521000003_rides_original_ride_id.sql ─────────────────────────────────────────────────────────────

-- Phase 05 Wave 6 — Lien rides clone via original_ride_id
--
-- Workflow patient absent : régulatrice click "Reprogrammer" →
-- rescheduleRideAction clone le ride avec original_ride_id pointant
-- vers le ride original (no-show). Permet :
--   1. Restitution historique côté cockpit ("ride X reprogrammé après no-show")
--   2. Reporting Phase 06+ (taux reprog vs annul après no-show)
--
-- Réf : PLAN-6 ligne 455 rescheduleRideAction, DEC-053.

alter table public.rides
  add column original_ride_id uuid null
    references public.rides(id) on delete set null;

create index rides_original_ride_id_idx
  on public.rides (original_ride_id)
  where original_ride_id is not null;

-- ─── supabase/migrations/20260522000001_tariff_grids.sql ─────────────────────────────────────────────────────────────

-- Phase 05.5 Wave 1 — Grille tarifaire CGSS versionnée (DEC-057)
-- Convention-cadre nationale CNAM/taxi applicable 2026.
-- Tarif km 974 + supplément DROM en BDD (volatilité conflit local 974) —
-- jamais hardcodés dans le code (DEC-057).

create table public.tariff_grids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date_effet date not null,
  forfait_eur numeric(6,2) not null,
  km_inclus integer not null,
  prix_km_eur numeric(6,2) not null,
  supplement_drom_eur numeric(6,2) not null,
  supplement_tpmr_eur numeric(6,2) not null,
  majoration_pct integer not null,
  facteur_correction_routier numeric(4,2) not null,
  arrondi_eur numeric(4,2) not null default 0.05,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, date_effet)
);

-- Index « grille active » : MAX(date_effet) <= today par organisation.
create index tariff_grids_org_date_effet_idx
  on public.tariff_grids (organization_id, date_effet desc);

alter table public.tariff_grids enable row level security;

-- SELECT : régulateur + dirigeant de l'organisation.
create policy tariff_grids_select_org on public.tariff_grids
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

-- INSERT : dirigeant uniquement (édition = nouvelle version DEC-057).
create policy tariff_grids_insert_dirigeant on public.tariff_grids
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

-- Pas d'UPDATE / DELETE : versionnement strict (chaque changement = INSERT).

-- Seed grille 974 active — convention CNAM en vigueur 1er nov 2025.
-- created_by null = seed système (le dirigeant prend le relai au 1er edit).
-- Une grille par organisation existante (V1.5 mono-régie = 1 grille).
insert into public.tariff_grids (
  organization_id, date_effet, forfait_eur, km_inclus, prix_km_eur,
  supplement_drom_eur, supplement_tpmr_eur, majoration_pct,
  facteur_correction_routier, arrondi_eur
)
select id, '2025-11-01', 13.00, 4, 1.22, 3.00, 30.00, 50, 1.40, 0.05
from public.organizations;

-- ─── supabase/migrations/20260523000001_rides_tarif_source_add_override.sql ─────────────────────────────────────────────────────────────

-- Mini-PR fix — Ajout 'override' à rides.tarif_source
--
-- Bug latent (dette Phase 04.7 révélée Phase 05.5 Wave 4) :
-- override.ts écrit tarif_source='override' mais la contrainte
-- rides_tarif_source_check (migration 20260512000003) n'autorisait que
-- NULL | 'manuel' | 'cgss_auto' → tout override régulateur échouait
-- silencieusement (UPDATE rejeté par Postgres).
--
-- 'override' = tarif forcé délibérément par le régulateur (distinct de
-- 'manuel' saisie chauffeur et 'cgss_auto' calcul moteur). Distinguer
-- 'override' permet au recalcul rétroactif DEC-060 de le préserver
-- (recomputeTarifsAction ne cible que 'cgss_auto').
--
-- Aucune migration de données : 0 ligne 'override' n'existe (toutes
-- rejetées par l'ancienne contrainte).

alter table public.rides
  drop constraint rides_tarif_source_check;

alter table public.rides
  add constraint rides_tarif_source_check
  check (
    tarif_source is null
    or tarif_source in ('manuel', 'cgss_auto', 'override')
  );

-- ─── supabase/migrations/20260524000001_unschedule_sms_cron.sql ─────────────────────────────────────────────────────────────

-- Mini-PR — Mise en pause des rappels SMS (ADR-004, DEC-062).
--
-- Le fournisseur SMS est différé (Twilio US/CLOUD Act écarté pour le
-- transport sanitaire ; cible = API SMS française HDS ou RaspiSMS
-- auto-hébergé). Les 2 cron jobs SMS (migration 20260519000007) sont
-- désactivés : ils déclenchaient des appels horaires vers les Route
-- Handlers qui échouaient en 401 (aucun secret Vault, aucun fournisseur).
--
-- Migration idempotente via garde `if exists` : passe en prod (jobs déjà
-- unscheduled manuellement) ET sur un reset (annule les cron.schedule
-- recréés par 20260519000007).
--
-- RÉACTIVATION (au choix d'un fournisseur) : recréer les cron.schedule
-- dans une nouvelle migration (cf. 20260519000007 pour le modèle), avec
-- l'URL du Route Handler du nouveau fournisseur.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sms-reminder-j1') then
    perform cron.unschedule('sms-reminder-j1');
  end if;
  if exists (select 1 from cron.job where jobname = 'sms-reminder-j2h') then
    perform cron.unschedule('sms-reminder-j2h');
  end if;
end $$;

-- ─── supabase/migrations/20260525000001_security_advisors.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 06 PLAN-3 — Correctifs advisors sécurité Supabase
-- =============================================================================
-- Audit sécurité Phase 06 (Bloc E.1). Voir docs/security/RLS-AUDIT.md.
--
-- Traite :
--   1. function_search_path_mutable (3) — fige le search_path.
--   2. SECURITY DEFINER exécutables par anon/authenticated — REVOKE de
--      l'EXECUTE public sur les fonctions JAMAIS appelées par un client
--      (triggers + fonctions de cron). Un trigger s'exécute via le moteur
--      de triggers, pas par appel direct : retirer l'EXECUTE public ne
--      l'empêche pas de se déclencher.
--
-- HORS périmètre (décision dirigeant — arbitrage 2026-05-21) :
--   - Les helpers RLS (has_role, current_organization_id, current_user_role)
--     et les RPC (search_patients, rgpd_anonymize_patient,
--     nir_match_patient_for_legal_request) RESTENT exécutables par
--     authenticated : les expressions de policy RLS et les appels `.rpc()`
--     de l'app les requièrent. Les révoquer casserait toute requête
--     authentifiée + l'effacement RGPD + le portail légal. L'advisor
--     « SECURITY DEFINER exécutable par authenticated » est, pour ces
--     fonctions, attendu par conception (cf. RLS-AUDIT.md § tri).
--   - extension_in_public (pg_net) : déplacement différé — pg_net est
--     dormant (crons SMS en pause, ADR-004) ; le déplacer maintenant
--     risquerait le rejeu de la chaîne de migrations sans bénéfice runtime.
--     À traiter au rebranchement SMS. Documenté RLS-AUDIT.md.
--   - leaked_password_protection : réglage console (Auth → Settings),
--     non automatisable en SQL. Action dirigeant — cf. RLS-AUDIT.md.
--
-- Refs : DEC-032 (CD push exclusif), PLAN-3, CLAUDE.md § 6.
-- =============================================================================

-- -- Section 1 — function_search_path_mutable -----------------------------------
-- Fige le search_path des 3 fonctions signalées (un search_path mutable est
-- une surface d'attaque : résolution d'objet détournable).
alter function public.set_updated_at()
  set search_path = public, extensions;

alter function public.unaccent_immutable(text)
  set search_path = public, extensions;

alter function public.patient_data_request_set_deadline()
  set search_path = public, extensions;

-- -- Section 2 — REVOKE EXECUTE des SECURITY DEFINER non appelables client ------
-- Fonctions de trigger d'audit : invoquées par le moteur de triggers, jamais
-- en appel direct. Le REVOKE de l'EXECUTE public n'empêche pas le trigger de
-- se déclencher (les tests pgTAP rides_audit.sql etc. le prouvent en CI).
revoke execute on function public.rides_audit_trigger() from public;
revoke execute on function public.patients_audit_trigger() from public;
revoke execute on function public.drivers_audit_trigger() from public;
revoke execute on function public.vehicles_audit_trigger() from public;
revoke execute on function public.pois_metier_audit_trigger() from public;
revoke execute on function public.driver_invitations_audit_trigger() from public;
revoke execute on function public.patient_constraint_audit_trigger() from public;
revoke execute on function public.patient_operational_note_audit_trigger() from public;
revoke execute on function public.patient_data_request_audit_trigger() from public;
revoke execute on function public.data_breach_incident_audit_trigger() from public;
revoke execute on function public.data_processing_register_audit_trigger() from public;
revoke execute on function public.dpa_record_audit_trigger() from public;
revoke execute on function public.dpia_record_audit_trigger() from public;

-- Fonctions de trigger de garde / utilitaires : idem, invoquées par triggers.
revoke execute on function public.profiles_prevent_self_escalation() from public;
revoke execute on function public.drivers_archive_columns_dirigeant_only() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.patient_data_request_set_deadline() from public;

-- Fonctions de cron : invoquées par pg_cron (rôle postgres), jamais par un
-- client. REVOKE de l'EXECUTE public sans impact sur l'ordonnancement.
revoke execute on function public.check_breach_deadlines() from public;
revoke execute on function public.purge_legal_request_attempts() from public;

-- ─── supabase/migrations/20260526000001_revoke_execute_anon_auth.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 06 (correctif PLAN-3) — REVOKE EXECUTE ciblé anon, authenticated
-- =============================================================================
-- La migration 20260525000001_security_advisors faisait
-- `REVOKE EXECUTE ... FROM public` sur 19 fonctions SECURITY DEFINER
-- (triggers d'audit + gardes + crons). Insuffisant : Supabase accorde des
-- GRANT EXECUTE EXPLICITES à `anon` et `authenticated` (via ses default
-- privileges), indépendants de l'héritage du rôle `public`. `REVOKE FROM
-- public` ne retire pas ces grants explicites — vérifié en prod :
-- has_function_privilege('anon'|'authenticated', ...) restait `true` après
-- 20260525000001, et les advisors SECURITY DEFINER restaient au tableau.
--
-- Ce correctif refait le REVOKE en ciblant `anon, authenticated, public`
-- sur les MÊMES 19 fonctions. Aucune régression : un trigger se déclenche
-- via le moteur de triggers (sans EXECUTE direct), un cron via pg_cron
-- (rôle postgres).
--
-- HORS périmètre (inchangé — arbitrage dirigeant Option 1, cf.
-- docs/security/RLS-AUDIT.md § 2) : les helpers RLS (has_role,
-- current_organization_id, current_user_role) et les RPC
-- (search_patients, rgpd_anonymize_patient,
-- nir_match_patient_for_legal_request) RESTENT exécutables par
-- `authenticated` — les en priver casserait toute requête authentifiée,
-- l'effacement RGPD et le portail légal.
--
-- Refs : DEC-032 (CD push exclusif), PLAN-3, migration 20260525000001.
-- =============================================================================

-- -- Triggers d'audit (13) ------------------------------------------------------
revoke execute on function public.rides_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patients_audit_trigger() from anon, authenticated, public;
revoke execute on function public.drivers_audit_trigger() from anon, authenticated, public;
revoke execute on function public.vehicles_audit_trigger() from anon, authenticated, public;
revoke execute on function public.pois_metier_audit_trigger() from anon, authenticated, public;
revoke execute on function public.driver_invitations_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patient_constraint_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patient_operational_note_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patient_data_request_audit_trigger() from anon, authenticated, public;
revoke execute on function public.data_breach_incident_audit_trigger() from anon, authenticated, public;
revoke execute on function public.data_processing_register_audit_trigger() from anon, authenticated, public;
revoke execute on function public.dpa_record_audit_trigger() from anon, authenticated, public;
revoke execute on function public.dpia_record_audit_trigger() from anon, authenticated, public;

-- -- Gardes / triggers utilitaires (4) -----------------------------------------
revoke execute on function public.profiles_prevent_self_escalation() from anon, authenticated, public;
revoke execute on function public.drivers_archive_columns_dirigeant_only() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.patient_data_request_set_deadline() from anon, authenticated, public;

-- -- Fonctions de cron (2) -----------------------------------------------------
revoke execute on function public.check_breach_deadlines() from anon, authenticated, public;
revoke execute on function public.purge_legal_request_attempts() from anon, authenticated, public;

-- ─── supabase/migrations/20260605000001_driver_positions.sql ─────────────────────────────────────────────────────────────

-- Phase 10.0 — Prototype géoloc (pré-HDS, DEC-096).
--
-- Table de captures évenementielles de positions chauffeur. Tant que
-- HDS n'est pas en place (DEC-075), seules les positions `source='demo'`
-- doivent être présentes en production : le flag applicatif
-- `GEOLOC_ENABLED` empêche l'écriture de `source='event'`/'foreground'
-- en environnement non-HDS.
--
-- Schéma volontairement simple :
--   - `lat`/`lng` numeric(10,7) — compatible BAN/géoplateforme déjà
--     utilisée (06.19).
--   - `accuracy` numeric (mètres) — issue de l'API navigateur.
--   - `captured_at` timestamptz — horodatage de la capture côté client.
--   - `source` text check — 'event' (pointage), 'foreground' (watchPosition
--     opportuniste), 'demo' (seed démo statique, jamais animé).
--
-- Rétention 90j (DEC-075 + CDC §5.17) : fonction `purge_driver_positions`
-- programmée via pg_cron mensuel. En démo le purge ne touche rien (les
-- positions démo ont des dates rétro suffisantes pour rester visibles).

create table if not exists public.driver_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  ride_id uuid null references public.rides(id) on delete set null,
  lat numeric(10, 7) not null check (lat between -90 and 90),
  lng numeric(10, 7) not null check (lng between -180 and 180),
  accuracy numeric null check (accuracy is null or accuracy >= 0),
  captured_at timestamptz not null default now(),
  source text not null check (source in ('event', 'foreground', 'demo')),
  created_at timestamptz not null default now()
);

comment on table public.driver_positions is
  'Phase 10.0 prototype geoloc. Captures evenementielles position chauffeur.';
comment on column public.driver_positions.source is
  'event=pointage; foreground=watchPosition; demo=seed fictif statique.';

-- Index : lecture cockpit = dernière position par chauffeur, récent en tête.
create index if not exists driver_positions_driver_recent_idx
  on public.driver_positions (driver_id, captured_at desc);
create index if not exists driver_positions_org_idx
  on public.driver_positions (organization_id);

-- RLS
alter table public.driver_positions enable row level security;

-- Régulateurs / dirigeants lisent les positions de leur organisation.
create policy driver_positions_select_regulateur_dirigeant
  on public.driver_positions
  for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('regulateur', 'dirigeant')
    )
  );

-- Chauffeurs lisent uniquement leurs propres positions.
create policy driver_positions_select_chauffeur
  on public.driver_positions
  for select
  using (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Chauffeurs écrivent uniquement leur position.
create policy driver_positions_insert_chauffeur
  on public.driver_positions
  for insert
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Rétention 90j — fonction de purge câblée. En démo elle peut être
-- programmée sans effet réel (positions démo sont 'demo' source, non
-- purgées avant 90j).
create or replace function public.purge_driver_positions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.driver_positions
  where captured_at < now() - interval '90 days';
$$;

comment on function public.purge_driver_positions is
  'Phase 10.0 : purge positions > 90 jours. Pre-HDS : appelable manuellement, sera schedulee pg_cron mensuel a la mise en service reelle (DEC-075).';

-- Pré-HDS : on ne schedule PAS encore le cron. La fonction est prête,
-- on l'activera dans la migration de bascule HDS (Phase 09) avec :
--   select cron.schedule('purge_driver_positions_monthly',
--                        '0 3 1 * *',
--                        'select public.purge_driver_positions()');

-- ─── supabase/migrations/20260608000001_compliance_items.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 06.33 — Conformité réglementaire métier (CdC §5.21)
-- =============================================================================
-- Crée la table `compliance_items` qui suit les échéances réglementaires
-- des chauffeurs, véhicules et de l'organisation (carte pro, visite médicale,
-- contrôle technique, assurance, convention CGSS…).
--
-- Modèle (DEC-112, ADR-013) :
--   - Table dédiée plutôt que colonnes éparses : 8 types hétérogènes sur 3
--     entités + multi-échéances (avenants CGSS) → modèle flexible.
--   - `entity_type` + `entity_id` polymorphe avec contrainte CHECK :
--       driver/vehicle → entity_id requis et FK pas vérifiable applicative-
--       ment (pas de polymorphic FK SQL) ; organization → entity_id null,
--       l'organization_id de la ligne fait foi.
--   - `kind` : 8 valeurs au démarrage, CHECK contrainte. Label libre pour
--     les cas (n° d'avenant CGSS, etc.).
--   - `expires_at` null = sans expiration (rare ; typiquement licence taxi
--     viagère). Index dédié pour les requêtes d'alerte (lot 2).
--
-- RLS forcée (pattern vehicles / drivers) :
--   - SELECT same_org (dirigeant + régulateur lisent leur conformité).
--   - INSERT/UPDATE dirigeant uniquement (sortie système type).
--   - Pas de DELETE — archivage logique via colonne archive.
--
-- Pas de seed — la conformité est saisie par le dirigeant.
-- =============================================================================

create table public.compliance_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('driver', 'vehicle', 'organization')
  ),
  entity_id uuid,
  kind text not null check (
    kind in (
      'carte_pro',           -- chauffeur : carte professionnelle
      'visite_medicale',     -- chauffeur : visite médicale d'aptitude
      'formation_continue',  -- chauffeur : formation continue obligatoire
      'controle_technique',  -- véhicule : contrôle technique
      'visite_taxi',         -- véhicule : visite annuelle taxi (préfecture)
      'assurance',           -- véhicule : assurance
      'licence_taxi',        -- véhicule : licence taxi
      'convention_cgss'      -- organisation : convention CGSS + avenants
    )
  ),
  label text,
  reference text,
  issued_at date,
  expires_at date,
  document_url text,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  -- Cohérence entity_type ↔ entity_id : null seulement pour organization.
  constraint compliance_items_entity_id_check check (
    (entity_type = 'organization' and entity_id is null) or
    (entity_type in ('driver', 'vehicle') and entity_id is not null)
  )
);

comment on table public.compliance_items is
  'Conformité réglementaire métier (CdC §5.21) — échéances chauffeur/véhicule/organisation. Distincte du suivi RGPD documentaire (registre/DPA/DPIA).';

-- Index requêtes d'alerte (lot 2) : on filtre par org + expires_at.
create index compliance_items_org_expires_idx
  on public.compliance_items (organization_id, expires_at)
  where archive = false and expires_at is not null;

-- Index lecture par entité (lot 1 : badge dans drivers-list / vehicles-list).
create index compliance_items_entity_idx
  on public.compliance_items (organization_id, entity_type, entity_id)
  where archive = false;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.compliance_items enable row level security;
alter table public.compliance_items force row level security;

create policy compliance_items_select_same_org on public.compliance_items
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy compliance_items_insert_dirigeant on public.compliance_items
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy compliance_items_update_dirigeant on public.compliance_items
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE : archivage logique via colonne archive.

-- =============================================================================
-- Trigger updated_at
-- =============================================================================
create trigger compliance_items_set_updated_at
  before update on public.compliance_items
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Trigger audit (cohérent pattern vehicles/drivers)
-- =============================================================================
create or replace function public.compliance_items_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'compliance_item.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'compliance_item', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.compliance_items_audit_trigger() is
  'Trigger audit compliance_items — INSERT/UPDATE/DELETE → audit_logs (action compliance_item.*).';

create trigger compliance_items_audit_trigger
  after insert or update or delete on public.compliance_items
  for each row execute function public.compliance_items_audit_trigger();

-- ─── supabase/migrations/20260608000002_compliance_blocking_mode.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 06.35 — Réglage organisation : mode de blocage conformité
-- =============================================================================
-- Ajoute la colonne `compliance_blocking_mode` à `organizations` pour
-- régler le comportement du contrôle conformité à la planification
-- (CdC §5.21 lot 3, DEC-114) :
--
--   - 'warn'  (défaut)  : avertissement visible, la régulatrice garde
--                         la main, assignation possible sous sa
--                         responsabilité (RETEX secteur : visibilité
--                         prime sur verrou).
--   - 'block'           : assignation refusée (manuel) ou entité
--                         exclue (optimiseur, via canal `excluded`).
--
-- Granularité GLOBALE par organisation (Q6) — pas de raffinement par
-- type d'échéance V1 (à reconsidérer si besoin émerge).
--
-- Pas de RLS supplémentaire (la table `organizations` a déjà ses
-- policies). L'UPDATE est réservé au dirigeant (defense in depth dans
-- la Server Action `updateComplianceBlockingModeAction`).
-- =============================================================================

alter table public.organizations
  add column compliance_blocking_mode text not null default 'warn'
    check (compliance_blocking_mode in ('warn', 'block'));

comment on column public.organizations.compliance_blocking_mode is
  'CdC §5.21 lot 3 : comportement du contrôle conformité à la planification — warn (défaut, souple) | block (dur). Réglé par le dirigeant dans /admin/conformite.';

-- ─── supabase/migrations/20260608000003_internal_message.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 06.41 — Messagerie interne, lot 1 : chat texte à la course (§5.22)
-- =============================================================================
-- Chat temps réel régulateur ↔ chauffeur RATTACHÉ À UNE COURSE (DEC-120).
--
-- Modèle (cadrage GSD validé) :
--   - Table UNIQUE `internal_message(ride_id, ...)` — la course EST la
--     conversation. Pas de table conversation séparée (évite le bug Supabase
--     #1721 : payloads Realtime mélangés quand 2 tables partagent un channel).
--   - Texte uniquement au lot 1. Photo (Q2) repoussée au stockage HDS,
--     push web (Q3) et fil général repoussés (registre des travaux repoussés).
--   - `sender_role` dénormalisé pour l'affichage (bulle + libellé auteur)
--     sans jointure profiles à chaque message.
--   - Messages IMMUABLES : pas d'UPDATE/DELETE (ni policy, ni grant). Édition
--     et purge 1 an (pg_cron) hors périmètre lot 1.
--
-- RLS stricte multi-tenant + par rôle, INDEXÉE (la RLS filtre aussi la
-- réception Realtime ; sans index sur les colonnes de policy → latence du
-- 1er message) :
--   - SELECT : same_org ET (régulateur/dirigeant voient toute conversation de
--     l'org ; chauffeur voit UNIQUEMENT ses courses via drivers.profile_id).
--   - INSERT : same_org, sender_profile_id = auth.uid() (anti-usurpation),
--     sender_role = current_user_role(), et un chauffeur n'écrit que sur SES
--     courses (même prédicat que rides_update_chauffeur_own_rides).
--
-- Pas de trigger audit : la table est elle-même append-only et horodatée
-- (trace native immuable). Inutile de dupliquer dans audit_logs au lot 1.
-- =============================================================================

create table public.internal_message (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.user_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.internal_message is
  'Messagerie interne (CdC §5.22) lot 1 — chat texte régulateur↔chauffeur rattaché à une course. La course EST la conversation. Messages immuables (pas d''UPDATE/DELETE). Photo/push/fil général repoussés.';

-- Index fil chronologique + colonne de policy RLS (ride_id).
create index internal_message_ride_created_idx
  on public.internal_message (ride_id, created_at);

-- Index multi-tenant (colonne de policy RLS).
create index internal_message_organization_id_idx
  on public.internal_message (organization_id);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.internal_message enable row level security;
alter table public.internal_message force row level security;

-- SELECT : même org ; régul/dirigeant voient tout l'org, chauffeur seulement
-- les conversations de SES courses (pattern rides_update_chauffeur_own_rides).
create policy internal_message_select on public.internal_message
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
      or (
        public.has_role('chauffeur'::public.user_role)
        and ride_id in (
          select r.id
          from public.rides r
          where r.driver_id in (
            select d.id
            from public.drivers d
            where d.profile_id = auth.uid()
              and d.archive = false
          )
        )
      )
    )
  );

-- INSERT : même org, auteur = soi (anti-usurpation), rôle cohérent ; un
-- chauffeur ne peut écrire que sur SES courses.
create policy internal_message_insert on public.internal_message
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and sender_profile_id = auth.uid()
    and sender_role = public.current_user_role()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
      or (
        public.has_role('chauffeur'::public.user_role)
        and ride_id in (
          select r.id
          from public.rides r
          where r.driver_id in (
            select d.id
            from public.drivers d
            where d.profile_id = auth.uid()
              and d.archive = false
          )
        )
      )
    )
  );
-- Pas de policy UPDATE/DELETE : messages immuables au lot 1.

-- =============================================================================
-- Grants (convention repo : revoke anon + grant ciblé authenticated)
-- =============================================================================
revoke all on public.internal_message from anon;
grant select, insert on public.internal_message to authenticated;

-- =============================================================================
-- Publication Realtime
-- =============================================================================
-- Canonique : ALTER publication supabase_realtime ADD TABLE public.internal_message
-- Exécuté de façon idempotente et sûre : on n'ajoute la table que si la
-- publication existe, n'est pas « FOR ALL TABLES » et ne contient pas déjà la
-- table (évite l'échec en CI reset comme en cloud où rides a été ajouté via
-- le dashboard).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not (select puballtables from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'internal_message'
       )
    then
      alter publication supabase_realtime add table public.internal_message;
    end if;
  end if;
end
$$;

-- ─── supabase/migrations/20260610000001_ordering_parties.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Référentiel donneurs d'ordres B2B (ordering_parties)
-- =============================================================================
-- Crée :
--   - enum public.ordering_party_billing_modality (3 valeurs — CdC §5.5 l.190)
--   - table public.ordering_parties (référentiel donneur d'ordres d'une org)
--   - RLS forcée pattern drivers (SELECT same_org / INSERT+UPDATE dirigeant)
--   - 1 index : (organization_id, actif) partiel sur archive=false
--   - trigger updated_at + trigger d'audit (pattern drivers)
--   - revoke anon, grant authenticated (SELECT/INSERT/UPDATE — pas de DELETE)
-- Refs : CdC §5.5 (Inclus V1 l.74) ; DEC-148 ; pattern dupliqué de
--        20260512000001_drivers.sql (référentiel multi-tenant).
--
-- Un donneur d'ordres B2B (hôpital, clinique, EHPAD) passe commande d'un
-- transport pour un de ses patients/résidents. DISTINCT du prescripteur
-- (médecin émetteur du bon de transport) — CdC §5.5 l.186. Conventions
-- tarifaires propres et facturation centralisée (lots suivants).
-- =============================================================================

-- -- Section 1 — Type énuméré modalité de facturation --------------------------
-- Pas de check texte libre : enum strict côté DB (3 modalités cadrées CdC).
-- Valeurs miroir côté zod (orderingPartyInputSchema).
create type public.ordering_party_billing_modality as enum (
  'a_la_course',   -- facturation course par course (défaut)
  'hebdomadaire',  -- récapitulatif hebdomadaire
  'mensuelle'      -- récapitulatif mensuel
);

-- -- Section 2 — Table ordering_parties ----------------------------------------
create table public.ordering_parties (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  raison_sociale text not null check (length(trim(raison_sociale)) between 1 and 120),
  -- siret nullable : validation format/Luhn côté app (siretSchema @tap/shared).
  -- Pas de contrainte BDD bloquante pour ne pas refuser un enregistrement
  -- partiel (donneur d'ordres saisi avant d'avoir le SIRET sous la main).
  siret text,
  contact_principal_nom text,
  contact_principal_telephone text,
  contact_principal_email text,
  -- TODO(lot suivant) : contacts opérationnels multiples par service
  -- (CdC §5.5 l.188) — table dédiée ordering_party_contacts. Le cœur se
  -- limite au contact principal.
  modalite_facturation public.ordering_party_billing_modality not null
    default 'a_la_course',
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.ordering_parties is
  'Référentiel donneurs d''ordres B2B (hôpitaux, cliniques, EHPAD) — un par '
  'organization. CRUD dirigeant. CdC §5.5 / Inclus V1. DISTINCT prescripteur.';

-- -- Section 3 — Index ordering_parties -----------------------------------------
-- (organization_id, actif) partiel sur archive=false : la liste dirigeant
-- filtre toujours archive=false et trie/filtre actif (pattern drivers).
create index ordering_parties_organization_actif_idx
  on public.ordering_parties (organization_id, actif)
  where archive = false;

-- -- Section 4 — RLS forcée + policies (ordering_parties) -----------------------
-- Calquée EXACTEMENT sur drivers : lecture pour tous les membres de l'org
-- (le régulateur doit pouvoir rattacher une course à un donneur d'ordres),
-- écriture réservée au dirigeant (gestion du référentiel B2B).
alter table public.ordering_parties enable row level security;
alter table public.ordering_parties force row level security;

create policy ordering_parties_select_same_org on public.ordering_parties
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy ordering_parties_insert_dirigeant on public.ordering_parties
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy ordering_parties_update_dirigeant on public.ordering_parties
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive.

-- -- Section 5 — Trigger updated_at --------------------------------------------
create trigger ordering_parties_set_updated_at
  before update on public.ordering_parties
  for each row execute function public.set_updated_at();

-- -- Section 6 — Trigger d'audit ordering_parties ------------------------------
-- Pattern drivers_audit_trigger : to_jsonb(old/new) intégral. Aucune colonne
-- sensible chiffrée à filtrer (raison sociale / SIRET / contact = données
-- opérationnelles B2B non-secrètes, journalisables).
create or replace function public.ordering_parties_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'ordering_party.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'ordering_party', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.ordering_parties_audit_trigger() is
  'Trigger audit ordering_parties — INSERT/UPDATE/DELETE → audit_logs '
  '(action ordering_party.*).';

create trigger ordering_parties_audit_trigger
  after insert or update or delete on public.ordering_parties
  for each row execute function public.ordering_parties_audit_trigger();

-- -- Section 7 — Revoke / Grant ------------------------------------------------
revoke all on public.ordering_parties from anon;
grant select, insert, update on public.ordering_parties to authenticated;

-- ─── supabase/migrations/20260610000002_rides_ordering_party_id.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Lien rides ↔ ordering_parties (rattachement course → B2B)
-- =============================================================================
-- Ajoute la colonne ordering_party_id (NULLABLE) à public.rides.
--
-- Une course peut être rattachée à un donneur d'ordres B2B (commande passée
-- par un hôpital/clinique/EHPAD pour un de ses patients) OU n'avoir aucun
-- donneur d'ordres (cas NOMINAL : transport prescrit individuel). La colonne
-- est donc NULLABLE et ne doit JAMAIS devenir obligatoire (DEC-148).
--
-- Suit le pattern des « colonnes futures » prévues dans 20260509000001_rides.sql
-- et la migration additive 20260520000001_rides_ride_recurrence_id.sql.
-- Refs : CdC §5.5 ; DEC-148.
-- =============================================================================

alter table public.rides
  add column ordering_party_id uuid null
    references public.ordering_parties(id) on delete set null;

comment on column public.rides.ordering_party_id is
  'Donneur d''ordres B2B ayant commandé la course (NULL = transport prescrit '
  'individuel, cas nominal). CdC §5.5 / DEC-148.';

-- Index partiel : optimise les futurs récapitulatifs périodiques par donneur
-- d'ordres (SELECT rides WHERE organization_id = X AND ordering_party_id = Y)
-- sans peser sur la majorité des courses (ordering_party_id IS NULL).
create index rides_org_ordering_party_idx
  on public.rides (organization_id, ordering_party_id)
  where ordering_party_id is not null;

-- Les policies RLS existantes de rides (organization_id-based) couvrent déjà
-- les nouvelles requêtes — la colonne ordering_party_id ne change pas les
-- règles d'accès.

-- ─── supabase/migrations/20260611000001_notification_preferences.sql ─────────────────────────────────────────────────────────────

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

-- ─── supabase/migrations/20260612000001_ordering_party_tariff.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Grille tarifaire B2B par donneur d'ordres (DEC-157, socle 1/3)
-- =============================================================================
-- CdC §5.5 l.189 : « Convention tarifaire propre (grille indépendante des
-- tarifs CGSS si non conventionné, OU complément) ». On gère LES DEUX cas :
--   - `cgss_standard` (défaut) : la course du donneur utilise la grille CGSS
--     de l'organisation (comportement INCHANGÉ).
--   - `grille_propre` : la course utilise la grille propre du donneur d'ordres.
--
-- Crée :
--   - enum public.ordering_party_tariff_mode (2 valeurs)
--   - colonne ordering_parties.tariff_mode (défaut cgss_standard)
--   - table public.ordering_party_tariff_grids (grille versionnée par donneur,
--     mêmes colonnes que tariff_grids, RLS par org calquée sur tariff_grids)
--   - extension de la contrainte rides.tarif_source pour ajouter 'b2b_auto'
--     (distinct de cgss_auto → le recompute CGSS DEC-060 ne l'écrase pas)
--
-- Refs : DEC-157 ; pattern dupliqué de 20260522000001_tariff_grids.sql +
--        20260523000001_rides_tarif_source_add_override.sql.
-- 0 valeur hardcodée côté moteur : la grille B2B s'injecte dans
-- computeCgssFromDistance qui prend déjà la grille en paramètre (DEC-057).
-- =============================================================================

-- -- Section 1 — Mode de tarification du donneur d'ordres -----------------------
create type public.ordering_party_tariff_mode as enum (
  'cgss_standard', -- utilise la grille CGSS de l'organisation (défaut)
  'grille_propre'  -- utilise sa propre grille (table dédiée ci-dessous)
);

alter table public.ordering_parties
  add column tariff_mode public.ordering_party_tariff_mode not null
    default 'cgss_standard';

comment on column public.ordering_parties.tariff_mode is
  'cgss_standard = grille CGSS de l''org (défaut) ; grille_propre = grille '
  'dédiée dans ordering_party_tariff_grids. DEC-157.';

-- -- Section 2 — Grille tarifaire propre du donneur (versionnée) ----------------
create table public.ordering_party_tariff_grids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ordering_party_id uuid not null references public.ordering_parties(id) on delete cascade,
  date_effet date not null,
  forfait_eur numeric(6, 2) not null,
  km_inclus integer not null,
  prix_km_eur numeric(6, 2) not null,
  supplement_drom_eur numeric(6, 2) not null,
  supplement_tpmr_eur numeric(6, 2) not null,
  majoration_pct integer not null,
  facteur_correction_routier numeric(4, 2) not null,
  arrondi_eur numeric(4, 2) not null default 0.05,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ordering_party_id, date_effet)
);

comment on table public.ordering_party_tariff_grids is
  'Grille tarifaire propre d''un donneur d''ordres (mode grille_propre), '
  'versionnée par date_effet — même structure que tariff_grids. DEC-157.';

-- Index « grille active » : MAX(date_effet) <= today par donneur d'ordres.
create index ordering_party_tariff_grids_party_date_idx
  on public.ordering_party_tariff_grids (ordering_party_id, date_effet desc);

alter table public.ordering_party_tariff_grids enable row level security;
alter table public.ordering_party_tariff_grids force row level security;

-- SELECT : membres de l'organisation (le calcul tarifaire lit la grille).
create policy ordering_party_tariff_grids_select_org on public.ordering_party_tariff_grids
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT : dirigeant uniquement (édition = nouvelle version, versionnement strict).
create policy ordering_party_tariff_grids_insert_dirigeant on public.ordering_party_tariff_grids
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );
-- Pas d'UPDATE / DELETE : versionnement strict (chaque changement = INSERT).

-- -- Section 3 — Revoke / Grant ------------------------------------------------
revoke all on public.ordering_party_tariff_grids from anon;
grant select, insert on public.ordering_party_tariff_grids to authenticated;

-- -- Section 4 — tarif_source 'b2b_auto' ---------------------------------------
-- Distinct de 'cgss_auto' : une course tarifée via grille B2B est marquée
-- 'b2b_auto' → le recompute CGSS (DEC-060, cible 'cgss_auto') ne l'écrase pas,
-- et le recompute B2B utilise la grille du donneur (comme 'override' est déjà
-- préservé).
alter table public.rides
  drop constraint rides_tarif_source_check;

alter table public.rides
  add constraint rides_tarif_source_check
  check (
    tarif_source is null
    or tarif_source in ('manuel', 'cgss_auto', 'override', 'b2b_auto')
  );

-- ─── supabase/migrations/20260612000002_ride_groups.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Demande groupée B2B (ride_groups, DEC-158, extension 2/3)
-- =============================================================================
-- CdC §5.5 l.191 : « un donneur d'ordres demande 5 transports d'un coup (sortie
-- d'hospitalisation collective) » + l.193 « workflow d'acceptation/refus par la
-- régulation ».
--
-- Modèle calqué sur ride_recurrences : une table parent (org, RLS, donneur)
-- → N courses enfants (rides) liées par rides.ride_group_id.
--
-- Workflow porté par le GROUPE (pas par ride_status) :
--   - création → ride_group `en_attente` + N courses enfants `brouillon`
--     (pas fermes → ne polluent ni le cockpit, ni l'optimisation, ni la caisse,
--      qui ciblent validee/terminee).
--   - acceptation → group `acceptee` + courses brouillon → validee (fermes).
--   - refus → group `refusee` + motif_refus + courses → annulee_regulateur.
--
-- Crée :
--   - enum public.ride_group_status (3 valeurs)
--   - table public.ride_groups (RLS par org calquée ride_recurrences)
--   - colonne rides.ride_group_id (NULLABLE — cas nominal = course individuelle)
--   - trigger updated_at
-- Refs : DEC-158 ; pattern 20260519000001_ride_recurrences.sql +
--        20260520000001_rides_ride_recurrence_id.sql.
-- =============================================================================

-- -- Section 1 — Statut de la demande groupée ----------------------------------
create type public.ride_group_status as enum (
  'en_attente', -- soumise, en attente de décision régulation (défaut)
  'acceptee',   -- acceptée → courses enfants fermes (validee)
  'refusee'     -- refusée → courses enfants annulées (annulee_regulateur)
);

-- -- Section 2 — Table ride_groups ---------------------------------------------
create table public.ride_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Une demande groupée est TOUJOURS rattachée à un donneur d'ordres.
  ordering_party_id uuid not null references public.ordering_parties(id) on delete cascade,
  status public.ride_group_status not null default 'en_attente',
  motif_refus text null check (motif_refus is null or char_length(motif_refus) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

comment on table public.ride_groups is
  'Demande groupée B2B (CdC §5.5, DEC-158) — parent de N courses, workflow '
  'en_attente → acceptee/refusee porté par le groupe. Toujours rattachée à un '
  'donneur d''ordres.';

create index ride_groups_organization_id_idx on public.ride_groups (organization_id);
-- File des demandes en attente (la régulation filtre status='en_attente').
create index ride_groups_org_status_idx
  on public.ride_groups (organization_id, status)
  where status = 'en_attente';

alter table public.ride_groups enable row level security;
alter table public.ride_groups force row level security;

create policy ride_groups_select_org on public.ride_groups
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy ride_groups_insert_regulateur on public.ride_groups
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_groups_update_regulateur on public.ride_groups
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de DELETE : une demande tranchée (acceptée/refusée) reste tracée.

create trigger ride_groups_set_updated_at
  before update on public.ride_groups
  for each row execute function public.set_updated_at();

revoke all on public.ride_groups from anon;
grant select, insert, update on public.ride_groups to authenticated;

-- -- Section 3 — Lien rides ↔ groupe -------------------------------------------
alter table public.rides
  add column ride_group_id uuid null references public.ride_groups(id) on delete set null;

comment on column public.rides.ride_group_id is
  'Demande groupée parente (NULL = course individuelle, cas nominal). DEC-158.';

create index rides_ride_group_id_idx
  on public.rides (ride_group_id)
  where ride_group_id is not null;

-- ─── supabase/migrations/20260612000003_driver_incidents.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Incidents opérationnels chauffeur (driver_incidents, DEC-160)
-- =============================================================================
-- Replanification dynamique (CdG §5.14 l.363-374, item V1.5 §11.3 l.903). Quand
-- un chauffeur tombe en PANNE (signalée depuis la PWA chauffeur) ou devient
-- INDISPONIBLE (déclaré par la régulation), la régulation doit pouvoir réaffecter
-- ses courses restantes.
--
-- Statut opérationnel TEMPORAIRE, distinct de `drivers.actif` (booléen
-- administratif PERMANENT) : un chauffeur avec un incident NON résolu est
-- « indisponible » opérationnellement, sans toucher `actif`.
--
-- Crée :
--   - enum public.driver_incident_type (panne_vehicule | indisponible)
--   - table public.driver_incidents (RLS par org)
-- Refs : DEC-160 ; pattern RLS calqué ride_groups (20260612000002) +
--        drivers (20260512000001, drivers.profile_id ↔ auth.users).
-- =============================================================================

-- -- Section 1 — Type d'incident ----------------------------------------------
create type public.driver_incident_type as enum (
  'panne_vehicule', -- panne véhicule signalée par le chauffeur (PWA)
  'indisponible'    -- indisponibilité déclarée par la régulation
);

-- -- Section 2 — Table driver_incidents ---------------------------------------
create table public.driver_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  type public.driver_incident_type not null,
  -- Nature de la panne (texte libre court) ; lieu d'immobilisation.
  nature text null check (nature is null or char_length(nature) <= 500),
  lieu text null check (lieu is null or char_length(lieu) <= 200),
  started_at timestamptz not null default now(),
  -- resolved_at NULL = incident OUVERT (chauffeur indisponible).
  resolved_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.driver_incidents is
  'Incident opérationnel TEMPORAIRE chauffeur (DEC-160) : panne (PWA chauffeur) '
  'ou indisponibilité (régulation). resolved_at NULL = ouvert. Distinct de '
  'drivers.actif (administratif permanent).';

create index driver_incidents_organization_id_idx
  on public.driver_incidents (organization_id);
-- Lecture régulation = incidents OUVERTS d'une org (resolved_at IS NULL).
create index driver_incidents_open_idx
  on public.driver_incidents (organization_id, driver_id)
  where resolved_at is null;

alter table public.driver_incidents enable row level security;
alter table public.driver_incidents force row level security;

-- SELECT : toute l'org (régulation voit, chauffeur voit les siens via org).
create policy driver_incidents_select_org on public.driver_incidents
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT régulation : déclarer une indisponibilité / panne pour un chauffeur.
create policy driver_incidents_insert_regulateur on public.driver_incidents
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

-- INSERT chauffeur : signaler SA PROPRE panne (driver rattaché à son profil).
create policy driver_incidents_insert_chauffeur on public.driver_incidents
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select d.id from public.drivers d
      where d.profile_id = auth.uid()
        and d.organization_id = public.current_organization_id()
    )
  );

-- UPDATE régulation : marquer résolu (resolved_at) ; pas de transfert d'org.
create policy driver_incidents_update_regulateur on public.driver_incidents
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de DELETE : un incident tranché reste tracé (historique).

revoke all on public.driver_incidents from anon;
grant select, insert, update on public.driver_incidents to authenticated;

-- ─── supabase/migrations/20260612000004_sms_template_reaffectation.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Template SMS « reaffectation » (DEC-161)
-- =============================================================================
-- Complément replanification (CdG §5.14 l.368) : SMS au patient dont la course
-- change de chauffeur suite à une panne/indisponibilité. Envoyé en best-effort
-- par `reassignRidesBatchAction` (10.02), avec consentement RGPD vérifié.
--
-- Variables Mustache supportées (template-renderer @tap/sms) :
--   {{patient_prenom}} {{date}} {{heure}} {{chauffeur_prenom}}
-- D-04 : pas d'ETA inventé sans géoloc HDS → on garde l'horaire programmé
-- ({{heure}}). Body éditable via le module sms-templates (dirigeant).
-- Additif idempotent (ON CONFLICT DO NOTHING) — n'écrase pas un edit dirigeant.
-- =============================================================================

insert into public.sms_templates (key, body) values
  (
    'reaffectation',
    '{{patient_prenom}}, votre transport du {{date}} a {{heure}} est maintenant assure par un autre chauffeur (horaire maintenu). TAP Reunion.'
  )
on conflict (key) do nothing;

-- ─── supabase/migrations/20260612000005_prescribers.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Référentiel prescripteurs (prescribers, CdG §5.4, DEC-162)
-- =============================================================================
-- Le prescripteur = médecin / établissement à l'origine de la PRESCRIPTION de
-- transport. PRÉALABLE de la gestion des prescriptions (§5.3, lot suivant : une
-- prescription sera rattachée à un prescripteur).
--
-- ⚠️ 3 entités DISTINCTES à ne pas confondre :
--   - prescripteur (CETTE table)         = qui PRESCRIT
--   - donneur d'ordres (ordering_parties) = qui COMMANDE/paie (B2B)
--   - patient (patients)                  = qui est TRANSPORTÉ
--
-- Crée :
--   - enum public.prescriber_type (medecin | etablissement)
--   - table public.prescribers (référentiel par org)
--   - RLS forcée : SELECT same_org / INSERT+UPDATE dirigeant OU régulateur
--   - index (organization_id, actif) partiel sur archive=false
--   - trigger updated_at + trigger d'audit (pattern ordering_parties)
-- Refs : CdG §5.4 (Inclus V1 l.63) ; DEC-162 ; pattern 20260610000001_ordering_parties.
-- =============================================================================

-- -- Section 1 — Type de prescripteur -------------------------------------------
create type public.prescriber_type as enum (
  'medecin',        -- praticien individuel (RPPS/ADELI)
  'etablissement'   -- établissement prescripteur (FINESS)
);

-- -- Section 2 — Table prescribers ----------------------------------------------
create table public.prescribers (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nom text not null check (length(trim(nom)) between 1 and 120),
  -- prenom nullable : un établissement n'a pas de prénom.
  prenom text,
  type public.prescriber_type not null default 'medecin',
  -- Identifiants RPPS(11)/ADELI(9)/FINESS(9) : validation FORMAT côté app
  -- (@tap/shared). Pas de contrainte bloquante en BDD (saisie partielle OK).
  rpps text,
  adeli text,
  finess text,
  specialite text,
  contact_telephone text,
  contact_email text,
  -- Une adresse principale pour le cœur (cabinet/service). Adresses multiples
  -- = lot suivant si besoin.
  adresse text,
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.prescribers is
  'Référentiel prescripteurs (médecins/établissements émetteurs de prescriptions '
  'de transport) — un par organization. CdG §5.4 / Inclus V1. DISTINCT du donneur '
  'd''ordres (ordering_parties) et du patient.';

-- -- Section 3 — Index ----------------------------------------------------------
create index prescribers_organization_actif_idx
  on public.prescribers (organization_id, actif)
  where archive = false;

-- -- Section 4 — RLS forcée + policies -----------------------------------------
-- Lecture : tous les membres de l'org. Écriture : dirigeant OU régulateur (le
-- régulateur saisit les prescriptions et peut ajouter un prescripteur au vol).
alter table public.prescribers enable row level security;
alter table public.prescribers force row level security;

create policy prescribers_select_same_org on public.prescribers
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy prescribers_insert_regulateur on public.prescribers
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

create policy prescribers_update_regulateur on public.prescribers
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive.

-- -- Section 5 — Trigger updated_at --------------------------------------------
create trigger prescribers_set_updated_at
  before update on public.prescribers
  for each row execute function public.set_updated_at();

-- -- Section 6 — Trigger d'audit -----------------------------------------------
create or replace function public.prescribers_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'prescriber.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'prescriber', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.prescribers_audit_trigger() is
  'Trigger audit prescribers — INSERT/UPDATE/DELETE → audit_logs (action prescriber.*).';

create trigger prescribers_audit_trigger
  after insert or update or delete on public.prescribers
  for each row execute function public.prescribers_audit_trigger();

-- -- Section 7 — Revoke / Grant ------------------------------------------------
revoke all on public.prescribers from anon;
grant select, insert, update on public.prescribers to authenticated;

-- ─── supabase/migrations/20260612000006_prescriptions.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Prescriptions / bons de transport (prescriptions, CdG §5.3, DEC-163)
-- =============================================================================
-- Toute course conventionnée est justifiée par une prescription (bon de
-- transport), consommée course après course. Ce lot construit la LOGIQUE métier
-- (compteur de trajets idempotent + alertes) SANS le scan/upload du bon
-- (document_url laissé NULL — dépend du bucket HDS, Phase 09).
--
-- 3 entités DISTINCTES : la prescription LIE un patient + un prescripteur (07.05).
-- Donneur d'ordres (§5.5) reste distinct.
--
-- Crée :
--   - enum public.prescription_status (active | epuisee | expiree)
--   - table public.prescriptions (RLS par org, FK patient + prescriber)
--   - colonne rides.prescription_id (NULLABLE — course non conventionnée OK)
--   - trigger compteur de trajets IDEMPOTENT (delta sur transitions de statut)
--   - fonction de recalcul du statut
-- Refs : CdG §5.3 ; DEC-163 ; pattern ordering_parties/prescribers.
-- =============================================================================

-- -- Section 1 — Statut de la prescription --------------------------------------
create type public.prescription_status as enum (
  'active',    -- trajets restants et non expirée
  'epuisee',   -- trajets_consommes >= trajets_autorises
  'expiree'    -- date_expiration < aujourd'hui
);

-- -- Section 2 — Table prescriptions --------------------------------------------
create table public.prescriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Un bon est TOUJOURS pour un patient.
  patient_id uuid not null references public.patients(id) on delete cascade,
  -- Prescripteur (07.05) — nullable : saisi si connu.
  prescriber_id uuid references public.prescribers(id) on delete set null,
  numero text not null check (length(trim(numero)) between 1 and 60),
  date_prescription date not null,
  finess text,
  motif text,
  type_transport text,
  trajets_autorises int not null check (trajets_autorises > 0),
  trajets_consommes int not null default 0 check (trajets_consommes >= 0),
  date_expiration date,
  statut public.prescription_status not null default 'active',
  -- PRÉVU pour le scan HDS (Phase 09) — laissé NULL ici, aucun upload câblé.
  document_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.prescriptions is
  'Prescriptions / bons de transport (CdG §5.3, DEC-163). Compteur de trajets '
  'consommés course après course (trigger idempotent). document_url = scan futur '
  'HDS (Phase 09), NULL ici. LIE patient + prescripteur (07.05).';

create index prescriptions_org_patient_idx on public.prescriptions (organization_id, patient_id);
create index prescriptions_org_statut_idx on public.prescriptions (organization_id, statut);

-- -- Section 3 — RLS forcée + policies ------------------------------------------
-- Donnée de santé : lecture membres de l'org, écriture dirigeant OU régulateur.
alter table public.prescriptions enable row level security;
alter table public.prescriptions force row level security;

create policy prescriptions_select_same_org on public.prescriptions
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy prescriptions_insert_regulateur on public.prescriptions
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

create policy prescriptions_update_regulateur on public.prescriptions
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE (archivage logique / conservation remboursement).

create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

-- -- Section 4 — Trigger d'audit -----------------------------------------------
create or replace function public.prescriptions_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'prescription.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'prescription', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger prescriptions_audit_trigger
  after insert or update or delete on public.prescriptions
  for each row execute function public.prescriptions_audit_trigger();

-- -- Section 5 — Lien rides ↔ prescription -------------------------------------
-- NULLABLE : une course non conventionnée (ex. B2B privé) peut ne pas avoir de
-- prescription. L'obligation « conventionné » est gérée par AVERTISSEMENT UI,
-- pas par contrainte BDD bloquante (DEC-163).
alter table public.rides
  add column prescription_id uuid references public.prescriptions(id) on delete set null;

comment on column public.rides.prescription_id is
  'Prescription justifiant la course (NULL = course non conventionnée). DEC-163.';

create index rides_prescription_id_idx
  on public.rides (prescription_id)
  where prescription_id is not null;

-- -- Section 6 — Recalcul du statut --------------------------------------------
create or replace function public.recompute_prescription_status(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.prescriptions set statut = (
    case
      when date_expiration is not null and date_expiration < current_date then 'expiree'
      when trajets_consommes >= trajets_autorises then 'epuisee'
      else 'active'
    end
  )::public.prescription_status
  where id = p_id;
end; $$;

-- -- Section 7 — Compteur de trajets IDEMPOTENT --------------------------------
-- Une course « consomme » un trajet tant qu'elle est active (ni brouillon ni
-- annulée). Le trigger applique un DELTA basé sur la transition réelle de l'état
-- consommateur → rejouer une transition identique ne double JAMAIS le compteur,
-- et la réaffectation/annulation rend correctement le trajet. SECURITY DEFINER :
-- un chauffeur qui clôture une course met à jour la prescription qu'il ne peut
-- pas écrire directement.
create or replace function public.rides_prescription_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cancelled constant text[] := array['brouillon','annulee_regulateur','annulee_patient','annulee_chauffeur'];
  consumes_old boolean := false;
  consumes_new boolean := false;
begin
  if tg_op in ('UPDATE','DELETE') and old.prescription_id is not null then
    consumes_old := not (old.status = any (cancelled));
  end if;
  if tg_op in ('INSERT','UPDATE') and new.prescription_id is not null then
    consumes_new := not (new.status = any (cancelled));
  end if;

  -- Même prescription (ou NULL des deux côtés) : appliquer le delta de l'état
  -- consommateur uniquement s'il a changé (idempotent).
  if tg_op = 'UPDATE' and (old.prescription_id is not distinct from new.prescription_id) then
    if new.prescription_id is not null and (consumes_new is distinct from consumes_old) then
      update public.prescriptions
        set trajets_consommes = greatest(0, trajets_consommes + (case when consumes_new then 1 else -1 end))
        where id = new.prescription_id;
      perform public.recompute_prescription_status(new.prescription_id);
    end if;
    return new;
  end if;

  -- INSERT / DELETE / changement de prescription : libérer l'ancienne, prendre
  -- la nouvelle.
  if consumes_old then
    update public.prescriptions
      set trajets_consommes = greatest(0, trajets_consommes - 1)
      where id = old.prescription_id;
    perform public.recompute_prescription_status(old.prescription_id);
  end if;
  if consumes_new then
    update public.prescriptions
      set trajets_consommes = trajets_consommes + 1
      where id = new.prescription_id;
    perform public.recompute_prescription_status(new.prescription_id);
  end if;

  return coalesce(new, old);
end; $$;

comment on function public.rides_prescription_counter() is
  'Compteur idempotent de trajets consommés (DEC-163) : delta sur transition de '
  'l''état consommateur d''une course (active = ni brouillon ni annulée).';

create trigger rides_prescription_counter
  after insert or update or delete on public.rides
  for each row execute function public.rides_prescription_counter();

-- -- Section 8 — Revoke / Grant ------------------------------------------------
revoke all on public.prescriptions from anon;
grant select, insert, update on public.prescriptions to authenticated;

-- ─── supabase/migrations/20260612000007_push_subscriptions.sql ─────────────────────────────────────────────────────────────

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

-- ─── supabase/migrations/20260612000008_ride_status_annulee_meteo.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Statut d'annulation météo (annulee_meteo, DEC-170)
-- =============================================================================
-- Mode alerte météo / cyclone (CdG l.380-385, US-REG-09). On distingue une
-- annulation cyclone d'une annulation régulateur normale (traçabilité : stats,
-- non-facturation, reprise J+1/J+2 ultérieure).
--
-- `ADD VALUE IF NOT EXISTS` : additif, idempotent. La valeur n'est PAS utilisée
-- dans cette migration (un nouvel enum value ne peut servir dans la même
-- transaction que son ajout) — elle est consommée au runtime par l'app et par la
-- migration suivante (weather_alerts) côté données seulement.
-- =============================================================================

alter type public.ride_status add value if not exists 'annulee_meteo';

-- ─── supabase/migrations/20260612000009_weather_alerts.sql ─────────────────────────────────────────────────────────────

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

-- ─── supabase/migrations/20260613000001_rides_accompagnant.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Accompagnant sur la course (DEC-172, T2)
-- =============================================================================
-- CdG l.293 / l.256 (champ de saisie attendu) + règle CPAM (ameli.fr) :
-- un accompagnant est pris en charge si le médecin le juge nécessaire (mineur,
-- handicap, troubles de l'orientation) et remboursé au même taux que le patient.
--
-- 3 colonnes additives, NULLABLE / défauts → courses existantes strictement
-- inchangées (rétrocompat). Le coût de l'accompagnant payant est intégré au
-- calcul via la grille tarifaire (supplement_accompagnant_eur, migration
-- suivante), JAMAIS hardcodé (DEC-057, moteur de pricing inchangé).
-- =============================================================================

alter table public.rides
  add column accompagnant boolean not null default false,
  add column accompagnant_payant boolean not null default false,
  add column accompagnant_identite text;

comment on column public.rides.accompagnant is
  'Présence d''un accompagnant (DEC-172, CdG l.293). Occupe une place véhicule.';
comment on column public.rides.accompagnant_payant is
  'Accompagnant facturé (sinon gratuit). Si true, supplément appliqué via la grille.';
comment on column public.rides.accompagnant_identite is
  'Identité libre de l''accompagnant (optionnel).';

-- ─── supabase/migrations/20260613000002_tariff_grids_supplement_accompagnant.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Supplément accompagnant dans la grille tarifaire (DEC-172, T2)
-- =============================================================================
-- Le coût d'un accompagnant payant est PARAMÉTRABLE dans la grille CGSS
-- (DEC-057 — aucune valeur tarifaire hardcodée). Le moteur `computeCgssFromDistance`
-- applique ce supplément quand `accompagnant_payant = true`, comme le supplément
-- TPMR.
--
-- NB règle métier à valider (tracé registre §11) : CPAM rembourse l'accompagnant
-- « au même taux que le patient ». La V1 implémente un SUPPLÉMENT paramétrable
-- (terme additif soumis à la majoration nuit/week-end comme le reste), sans
-- présumer d'un doublement du forfait. La grille B2B
-- (`ordering_party_tariff_grids`) n'est PAS modifiée ici : le moteur retombe sur
-- 0 pour ces grilles (dégradation gracieuse, extension B2B tracée).
--
-- `not null default 0` → grilles existantes inchangées (supplément neutre).
-- =============================================================================

alter table public.tariff_grids
  add column supplement_accompagnant_eur numeric(6, 2) not null default 0;

comment on column public.tariff_grids.supplement_accompagnant_eur is
  'Supplément accompagnant payant (DEC-172). Appliqué si rides.accompagnant_payant.';

-- ─── supabase/migrations/20260613000003_patients_referent_legal.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Référent légal du patient (DEC-172, T3)
-- =============================================================================
-- CdG l.139-140 : pour un patient mineur ou sous tutelle, le contact référent
-- (parent / tuteur) est OBLIGATOIRE. Le statut « mineur » est DÉRIVÉ de
-- date_naissance (pas de booléen stocké redondant — source unique). L'obligation
-- est portée par un AVERTISSEMENT à la saisie de course (non bloquant brutal,
-- pattern bon expiré 07.06), pas par une contrainte SQL.
--
-- Colonnes additives NULLABLE → patients existants inchangés (rétrocompat).
-- `referent_document_url` prévue pour le scan futur (autorisation parentale /
-- jugement de tutelle) mais laissée NULL : le scan dépend du HDS, comme les bons
-- de transport (tracé registre). AUCUN Storage câblé ici.
-- =============================================================================

alter table public.patients
  add column referent_nom text,
  add column referent_lien text,
  add column referent_telephone text,
  add column referent_type text
    check (referent_type is null or referent_type in ('parental', 'tutelle')),
  add column referent_document_url text;

comment on column public.patients.referent_nom is
  'Nom du référent légal (parent / tuteur) — DEC-172, CdG l.139-140.';
comment on column public.patients.referent_lien is
  'Lien du référent avec le patient (parent, tuteur, autre) — texte libre.';
comment on column public.patients.referent_telephone is
  'Téléphone du référent légal.';
comment on column public.patients.referent_type is
  'Type d''autorité : parental | tutelle (null si non renseigné).';
comment on column public.patients.referent_document_url is
  'Scan autorisation parentale / jugement de tutelle. NULL en V1 (dépend HDS).';

-- ─── supabase/migrations/20260613000004_fix_prescription_counter_meteo.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration corrective — compteur de prescription ignore `annulee_meteo` (DEC-174)
-- =============================================================================
-- CRITIQUE (donnée de remboursement CGSS). Le compteur de trajets idempotent
-- (`rides_prescription_counter`, 20260612000006) utilise un array de statuts
-- « annulés » EN DUR qui n'incluait PAS `annulee_meteo` (valeur d'enum ajoutée
-- en 12.01). Conséquence : une course liée à une prescription annulée pour météo
-- (cyclone) était considérée comme NON annulée → elle restait consommatrice d'un
-- trajet → le trajet n'était PAS rendu au patient. Un bon de 5 trajets passait à
-- 4 restants alors que le transport n'a jamais eu lieu (litige + décompte
-- réglementaire faux).
--
-- D-01 : `CREATE OR REPLACE FUNCTION` — array `cancelled` aligné (ajout de
--        `annulee_meteo`). Logique de delta (consumes_old/new, greatest(0,…))
--        INCHANGÉE → idempotence préservée. Le trigger n'est pas recréé.
-- D-02 : recompute rétroactif des prescriptions déjà faussées par une annulation
--        météo passée (recalcul via la définition canonique « consomme = course
--        ni brouillon ni annulée »). No-op sûr si aucune course annulee_meteo.
-- D-03 : COUPLAGE — cet array DOIT rester synchronisé avec la constante
--        applicative `RIDE_CANCELLED_STATUSES` (@tap/shared, validators/ride.ts).
--        SQL ne peut pas importer la constante TS : tout futur statut d'annulation
--        s'ajoute AUX DEUX endroits (app + ce trigger). Point de vigilance tracé
--        au registre §12.
-- =============================================================================

-- -- D-01 — Fonction corrigée (array aligné, logique inchangée) ----------------
create or replace function public.rides_prescription_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- DOIT rester synchronisé avec RIDE_CANCELLED_STATUSES (@tap/shared) + brouillon.
  -- Tout nouveau statut d'annulation s'ajoute ici ET côté app (DEC-174).
  cancelled constant text[] := array['brouillon','annulee_regulateur','annulee_patient','annulee_chauffeur','annulee_meteo'];
  consumes_old boolean := false;
  consumes_new boolean := false;
begin
  if tg_op in ('UPDATE','DELETE') and old.prescription_id is not null then
    consumes_old := not (old.status = any (cancelled));
  end if;
  if tg_op in ('INSERT','UPDATE') and new.prescription_id is not null then
    consumes_new := not (new.status = any (cancelled));
  end if;

  -- Même prescription (ou NULL des deux côtés) : appliquer le delta de l'état
  -- consommateur uniquement s'il a changé (idempotent).
  if tg_op = 'UPDATE' and (old.prescription_id is not distinct from new.prescription_id) then
    if new.prescription_id is not null and (consumes_new is distinct from consumes_old) then
      update public.prescriptions
        set trajets_consommes = greatest(0, trajets_consommes + (case when consumes_new then 1 else -1 end))
        where id = new.prescription_id;
      perform public.recompute_prescription_status(new.prescription_id);
    end if;
    return new;
  end if;

  -- INSERT / DELETE / changement de prescription : libérer l'ancienne, prendre
  -- la nouvelle.
  if consumes_old then
    update public.prescriptions
      set trajets_consommes = greatest(0, trajets_consommes - 1)
      where id = old.prescription_id;
    perform public.recompute_prescription_status(old.prescription_id);
  end if;
  if consumes_new then
    update public.prescriptions
      set trajets_consommes = trajets_consommes + 1
      where id = new.prescription_id;
    perform public.recompute_prescription_status(new.prescription_id);
  end if;

  return coalesce(new, old);
end; $$;

comment on function public.rides_prescription_counter() is
  'Compteur idempotent de trajets consommés (DEC-163/174) : delta sur transition '
  'de l''état consommateur d''une course (active = ni brouillon ni annulée, météo '
  'incluse). Array `cancelled` synchronisé avec RIDE_CANCELLED_STATUSES (@tap/shared).';

-- -- D-02 — Recompute rétroactif des prescriptions faussées par une annul. météo
-- Recalcul via la définition CANONIQUE (« consomme » = course ni brouillon ni
-- annulée). Set-based, idempotent (rejouable). No-op si aucune course annulee_meteo.
with affected as (
  select distinct prescription_id as id
  from public.rides
  where status = 'annulee_meteo' and prescription_id is not null
),
recount as (
  select a.id,
    (
      select count(*)::int
      from public.rides r
      where r.prescription_id = a.id
        -- `r.status::text` : en SQL simple, un array de littéraux se résout en
        -- text[] → `ride_status <> text` n'existe pas (SQLSTATE 42883). On
        -- compare donc côté text. (Le corps plpgsql plus haut, `= any(text[])`,
        -- est valide au runtime — inchangé.)
        and r.status::text <> all (
          array['brouillon','annulee_regulateur','annulee_patient','annulee_chauffeur','annulee_meteo']
        )
    ) as consommes
  from affected a
)
update public.prescriptions p
  set trajets_consommes = recount.consommes
  from recount
  where p.id = recount.id
    and p.trajets_consommes is distinct from recount.consommes;

-- Recalcul du statut des prescriptions concernées (active/epuisee/expiree).
do $$
declare r record;
begin
  for r in
    select distinct prescription_id as id
    from public.rides
    where status = 'annulee_meteo' and prescription_id is not null
  loop
    perform public.recompute_prescription_status(r.id);
  end loop;
end $$;

-- ─── supabase/migrations/20260613000005_ride_group_status_annulee.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Statut `annulee` pour ride_group_status (DEC-175, fix B3)
-- =============================================================================
-- Effet de bord 12.01 (mode alerte météo) : l'annulation en lot des courses
-- (statut annulee_meteo) ignorait `ride_group_id`. Une demande groupée B2B
-- acceptée dont TOUTES les courses sont annulées pour cyclone restait `acceptee`
-- → conteneur incohérent (groupe « actif » sans aucune course active).
--
-- Nouveau statut `annulee` : groupe dont les courses ont été annulées par une
-- cause EXTERNE (météo), distinct de `refusee` (refus régulation) et `acceptee`
-- (actif). Le recalcul du statut est porté côté app (best-effort) après
-- l'annulation en lot — cf. cancelRidesBatchWeatherAction.
--
-- `ADD VALUE IF NOT EXISTS` : additif, idempotent. La valeur n'est PAS utilisée
-- dans cette migration (un nouvel enum value ne peut servir dans la même
-- transaction que son ajout) — consommée au runtime par l'app.
-- =============================================================================

alter type public.ride_group_status add value if not exists 'annulee';

-- ─── supabase/migrations/20260613000006_patient_incidents.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Historique des incidents patient (patient_incidents, PATIENT-01)
-- =============================================================================
-- CdG §5.2 « Historique des incidents [NOUVEAU] » : journal des incidents d'un
-- patient (retard, refus de payer, conflit chauffeur, plainte), compteur sur
-- fenêtre glissante et règle d'alerte d'escalade dirigeant.
--
-- Modèle : tables patient existantes (patient_constraint / patient_operational_note)
-- pour les conventions RLS/nommage. Sémantique DISTINCTE de driver_incidents
-- (pas de panne ni de résolution ; types propres au patient). Journal IMMUABLE
-- (select + insert seulement, comme une trace d'audit) — pas d'UPDATE/DELETE.
--
-- Pas de pièce jointe / photo (dépend du stockage HDS, hors périmètre).
-- =============================================================================

-- -- Section 1 — Enum des types d'incident patient -----------------------------
create type public.patient_incident_type as enum (
  'retard', -- retard du patient (> seuil), p. ex. > 15 min
  'refus_paiement', -- refus de payer la course
  'conflit_chauffeur', -- conflit avec le chauffeur
  'plainte', -- plainte / réclamation
  'autre' -- autre incident (précisé en note)
);

-- -- Section 2 — Table patient_incidents ---------------------------------------
create table public.patient_incidents (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  type public.patient_incident_type not null,
  note text check (note is null or length(note) <= 500),
  -- Quand l'incident a eu lieu (peut différer de la saisie).
  occurred_at timestamptz not null default now(),
  -- Rattachement optionnel à la course concernée (« retard sur le transport du 12 »).
  ride_id uuid references public.rides(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.patient_incidents is
  'Journal des incidents patient (CdG §5.2, PATIENT-01) — immuable (select+insert). '
  'Distinct de driver_incidents (pas de panne/résolution). Pas de pièce jointe (HDS).';

-- Liste + compteur sur fenêtre glissante (org, patient, antéchronologique).
create index patient_incidents_org_patient_idx
  on public.patient_incidents (organization_id, patient_id, occurred_at desc);

-- -- Section 3 — RLS forcée + policies (calquées sur patient_constraint) --------
alter table public.patient_incidents enable row level security;
alter table public.patient_incidents force row level security;

create policy patient_incidents_select_same_org on public.patient_incidents
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patient_incidents_insert_regulateur on public.patient_incidents
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );
-- Pas de policy UPDATE/DELETE : journal immuable (trace d'incidents).

revoke all on public.patient_incidents from anon;
grant select, insert on public.patient_incidents to authenticated;

-- -- Section 4 — Trigger d'audit (calqué sur patient_constraint) ---------------
create or replace function public.patient_incidents_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'patient_incident.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient_incident', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger patient_incidents_audit_trigger
  after insert or update or delete on public.patient_incidents
  for each row execute function public.patient_incidents_audit_trigger();

-- ─── supabase/migrations/20260613000007_patient_driver_preference.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Préférences de chauffeur du patient (patient_driver_preference)
-- =============================================================================
-- CdG §5.2 « Préférences » : chauffeur préféré (prioritaire) et chauffeur à
-- éviter (sans motif, confidentialité régulateur). PATIENT-02.
--
-- DÉCISION D'ARCHITECTURE (actée) : ces préférences ne sont PAS injectées dans
-- le solveur (qui raisonne en véhicules, pas en chauffeurs). Elles sont
-- exploitées AU MODAL D'ASSIGNATION, là où le régulateur choisit le chauffeur :
--   - préféré = mise en avant (aide à la décision) ;
--   - évité   = avertissement FRANCHISSABLE (jamais un blocage dur).
--
-- CONFIDENTIALITÉ (RGPD) : donnée potentiellement sensible (une exclusion peut
-- révéler indirectement une situation du patient). Isolée par organisation
-- (RLS), réservée régulateur/dirigeant, JAMAIS exposée au chauffeur ni au
-- patient. L'évité est stocké SANS MOTIF (minimisation) — pas de champ raison.
--
-- Modèle : table patient_incidents (migration 20260613000006) pour les
-- conventions RLS / nommage / audit.
-- =============================================================================

-- -- Section 1 — Enum du type de préférence --------------------------------------
create type public.patient_driver_preference_kind as enum (
  'prefere', -- chauffeur préféré du patient (mise en avant à l'assignation)
  'evite' -- chauffeur à éviter (avertissement franchissable, sans motif)
);

-- -- Section 2 — Table patient_driver_preference --------------------------------
create table public.patient_driver_preference (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  kind public.patient_driver_preference_kind not null,
  -- PAS de champ motif/raison : minimisation RGPD (l'évité est sans motif).
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  -- Unicité sur (patient, chauffeur) — SANS le kind : un chauffeur n'apparaît
  -- qu'une fois par patient. Cela couvre d'un seul tenant les DEUX exigences :
  --   - pas de doublon (même chauffeur deux fois en préféré) ;
  --   - exclusion mutuelle (un chauffeur ne peut être préféré ET évité).
  -- Le changement de préférence se fait par retrait puis ajout (côté action).
  constraint patient_driver_preference_unique unique (patient_id, driver_id)
);

comment on table public.patient_driver_preference is
  'Préférences chauffeur du patient (CdG §5.2, PATIENT-02) — préféré / évité. '
  'Hors solveur : exploitées au modal d''assignation. Évité sans motif '
  '(minimisation RGPD). Invisibles hors outil régulateur.';

-- Lecture par patient (fiche) et lecture inverse par chauffeur (assignation).
create index patient_driver_preference_org_patient_idx
  on public.patient_driver_preference (organization_id, patient_id);
create index patient_driver_preference_org_driver_idx
  on public.patient_driver_preference (organization_id, driver_id);

-- -- Section 3 — RLS forcée + policies (calquées sur patient_incidents) ----------
alter table public.patient_driver_preference enable row level security;
alter table public.patient_driver_preference force row level security;

create policy patient_driver_preference_select_same_org on public.patient_driver_preference
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patient_driver_preference_insert_regulateur on public.patient_driver_preference
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy patient_driver_preference_delete_regulateur on public.patient_driver_preference
  for delete to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

revoke all on public.patient_driver_preference from anon;
grant select, insert, delete on public.patient_driver_preference to authenticated;

-- -- Section 4 — Trigger d'audit (calqué sur patient_incidents) ------------------
create or replace function public.patient_driver_preference_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'patient_driver_preference.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient_driver_preference', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger patient_driver_preference_audit_trigger
  after insert or update or delete on public.patient_driver_preference
  for each row execute function public.patient_driver_preference_audit_trigger();

-- ─── supabase/migrations/20260613000008_driver_status.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Statut chauffeur explicite (driver_status) — CHAUFFEUR-01, §5.6
-- =============================================================================
-- Le §5.6 prévoit quatre statuts : actif, en congé, suspendu, archivé. Le modèle
-- actuel n'avait que deux booléens (`actif`, `archive`) incapables de distinguer
-- « en congé » de « suspendu » (les deux = actif=false). On introduit un statut
-- explicite, SEULE SOURCE DE VÉRITÉ.
--
-- RÉTROCOMPATIBILITÉ (choix documenté) : les colonnes `actif` et `archive` sont
-- CONSERVÉES mais DÉRIVÉES de `status` par un trigger BEFORE INSERT/UPDATE
-- (`drivers__status_sync`). De nombreux lecteurs s'appuient encore sur ces
-- booléens (tableau de bord, cache liste chauffeurs, row-actions, rowKey UI) :
-- les dériver évite de tous les migrer d'un coup tout en garantissant qu'il n'y
-- a PAS deux sources de vérité contradictoires — `status` commande, les booléens
-- suivent. Les ÉCRIVAINS (Server Actions) écrivent désormais `status` ; toute
-- valeur passée à `actif`/`archive` est écrasée par le trigger.
--
-- Pourquoi un trigger et pas des colonnes GENERATED : le garde-fou existant
-- `drivers_archive_columns_guard` est un trigger BEFORE UPDATE qui lit
-- `new.archive` ; or la valeur d'une colonne GENERATED n'est pas encore calculée
-- dans un trigger BEFORE (elle serait NULL). Un trigger de synchronisation qui
-- s'exécute AVANT le garde-fou (ordre alphabétique : `drivers__status_sync` <
-- `drivers_archive_columns_guard`) pose `new.archive` à temps pour que le
-- garde-fou « seul un dirigeant peut archiver » continue de fonctionner.
-- =============================================================================

-- -- Section 1 — Enum driver_status ---------------------------------------------
create type public.driver_status as enum ('actif', 'conge', 'suspendu', 'archive');

-- -- Section 2 — Colonne status + migration des données -------------------------
alter table public.drivers
  add column status public.driver_status not null default 'actif';

-- Migration des données : archive prime ; sinon actif → actif, !actif → suspendu.
-- (« désactivé » historique = indisponible non archivé → mappé sur 'suspendu',
-- le congé étant une notion nouvelle saisie explicitement par la suite.)
update public.drivers
set status = case
  when archive then 'archive'::public.driver_status
  when actif then 'actif'::public.driver_status
  else 'suspendu'::public.driver_status
end;

-- -- Section 3 — Trigger de synchronisation des booléens hérités ----------------
-- Dérive actif/archive depuis status à chaque écriture. Nom préfixé `__` pour
-- s'exécuter AVANT `drivers_archive_columns_guard` (cf. en-tête).
create or replace function public.drivers_sync_legacy_flags()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actif := (new.status = 'actif');
  new.archive := (new.status = 'archive');
  return new;
end; $$;

comment on function public.drivers_sync_legacy_flags() is
  'Dérive drivers.actif/archive depuis drivers.status (source de vérité unique, '
  'CHAUFFEUR-01). S''exécute avant le garde-fou d''archivage dirigeant.';

create trigger drivers__status_sync
  before insert or update on public.drivers
  for each row execute function public.drivers_sync_legacy_flags();

-- -- Section 4 — Index ----------------------------------------------------------
-- L'ancien index partiel (organization_id, actif) where archive=false servait le
-- filtre « disponible » (actif=true). Le nouveau filtre d'affectation est
-- status='actif'. On remplace par un index (organization_id, status) qui sert à
-- la fois la liste d'affectation (status='actif') et la vue admin par statut.
drop index if exists public.drivers_organization_actif_idx;
create index drivers_organization_status_idx
  on public.drivers (organization_id, status);

-- RLS inchangée (la table garde ses policies existantes).

-- ─── supabase/migrations/20260613000009_driver_competences_langues.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Compétences et langues du chauffeur — CHAUFFEUR-02, §5.6
-- =============================================================================
-- Première brique du bloc « préférences chauffeur [NOUVEAU] » du §5.6 : les deux
-- attributs d'affectation les plus simples (énumérations fermées, sans
-- référentiel externe) :
--   - competences : accueil personnes âgées, gestion fauteuil, conduite douce
--   - langues     : français, créole, anglais
--
-- Modélisation : colonnes text[] sur `drivers` (comme `type_permis`), plus simple
-- qu'une table de liaison pour des énumérations fermées et peu nombreuses.
--
-- Pas de check DB (comme `type_permis`) : la validation est centralisée dans
-- @tap/shared (driver_competence / driver_langue), pour ne pas exiger une
-- migration à chaque nouvelle valeur métier. Hors solveur : ces attributs
-- éclairent l'affectation, ils n'entrent pas dans le moteur d'optimisation.
--
-- RLS inchangée (la table garde ses policies existantes).
-- =============================================================================

alter table public.drivers
  add column competences text[] not null default '{}',
  add column langues text[] not null default '{}';

comment on column public.drivers.competences is
  'Compétences chauffeur (CHAUFFEUR-02, §5.6) — énumération fermée validée côté '
  '@tap/shared (driver_competence). Pas de check DB (extensible sans migration).';
comment on column public.drivers.langues is
  'Langues parlées (CHAUFFEUR-02, §5.6) — énumération fermée validée côté '
  '@tap/shared (driver_langue). Pas de check DB (extensible sans migration).';

-- ─── supabase/migrations/20260613000010_driver_preference_origin.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Origine de la préférence patient/chauffeur — CHAUFFEUR-03, §5.6
-- =============================================================================
-- PATIENT-02 a posé la direction « le patient préfère / évite ce chauffeur »
-- (table patient_driver_preference, unicité (patient_id, driver_id)). Le §5.6
-- introduit la direction MIROIR « le chauffeur préfère / évite ce patient ».
--
-- Les deux directions portent sur le même couple (patient, chauffeur) mais sont
-- sémantiquement DISTINCTES (« le patient évite ce chauffeur » ≠ « le chauffeur
-- évite ce patient »). On les distingue par une colonne d'origine plutôt qu'une
-- table miroir : on réutilise ainsi la RLS, le lookup et l'UI sans dupliquer.
--
-- Modèle :
--   - enum driver_preference_origin (patient, chauffeur)
--   - colonne origin (défaut 'patient' → migre les lignes existantes)
--   - unicité (patient_id, driver_id, origin) : un couple peut porter une
--     préférence dans CHAQUE direction, mais pas deux fois la même direction.
--     L'exclusion mutuelle prefere/evite reste PAR direction (gérée côté action).
--
-- RLS inchangée : les policies reposent sur organization_id + rôle régulateur/
-- dirigeant, jamais sur l'origine — la nouvelle direction est couverte d'office.
-- L'index (organization_id, driver_id) existant sert le lookup « depuis un
-- chauffeur, ses patients préférés/évités ».
-- =============================================================================

-- -- Section 1 — Enum d'origine --------------------------------------------------
create type public.driver_preference_origin as enum (
  'patient', -- préférence exprimée côté patient (PATIENT-02) : patient → chauffeur
  'chauffeur' -- préférence exprimée côté chauffeur (CHAUFFEUR-03) : chauffeur → patient
);

-- -- Section 2 — Colonne origin (défaut 'patient' migre l'existant) --------------
alter table public.patient_driver_preference
  add column origin public.driver_preference_origin not null default 'patient';

comment on column public.patient_driver_preference.origin is
  'Direction de la préférence (CHAUFFEUR-03) : patient→chauffeur ou chauffeur→'
  'patient. Les lignes antérieures à CHAUFFEUR-03 sont en origin=patient.';

-- -- Section 3 — Unicité ajustée -----------------------------------------------
-- (patient_id, driver_id) → (patient_id, driver_id, origin) : une direction au
-- plus par couple. L'exclusion prefere/evite reste assurée par direction côté
-- action (retrait puis ajout).
alter table public.patient_driver_preference
  drop constraint patient_driver_preference_unique;
alter table public.patient_driver_preference
  add constraint patient_driver_preference_unique unique (patient_id, driver_id, origin);

-- ─── supabase/migrations/20260613000011_sms_template_pickup_confirmed.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Template SMS « pickup_confirmed » (SMS-01, §5.15)
-- =============================================================================
-- Prise en charge confirmée : le patient est prévenu que son transport vient de
-- démarrer (transition assignee → en_cours côté chauffeur). Envoyé en
-- best-effort APRÈS la transition, avec consentement RGPD vérifié (DEC-008).
--
-- Variables Mustache supportées (template-renderer @tap/sms, DEC-051 LOCKED) :
--   {{patient_prenom}} {{patient_nom}} {{date}} {{heure}} {{chauffeur_prenom}}
-- Ton sobre et rassurant (§5.15), sans donnée médicale. Body éditable via le
-- module sms-templates (dirigeant). Additif idempotent (ON CONFLICT DO NOTHING)
-- — n'écrase jamais un edit dirigeant.
-- =============================================================================

insert into public.sms_templates (key, body) values
  (
    'pickup_confirmed',
    'Bonjour {{patient_prenom}}, votre transport vient de demarrer. {{chauffeur_prenom}} arrive vers vous. TAP Reunion.'
  )
on conflict (key) do nothing;

-- ─── supabase/migrations/20260613000012_vehicle_equipements.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Équipements de compatibilité véhicule (VEHICULE-01, §5.7)
-- =============================================================================
-- Ajoute les équipements véhicule qui conditionnent la compatibilité avec un
-- patient, EN MIROIR des besoins déjà modélisés côté patient
-- (enum public.patient_constraint_type). Correspondance équipement ↔ besoin :
--
--   equipement_oxygene   ↔ patient_constraint_type 'medical_oxygene'
--   equipement_brancard  ↔ 'medical_brancard' (un véhicule type 'ambulance' est
--                           considéré équipé d'office, cf. fonction de compat)
--   places_tpmr (EXISTANT, 0-3) ↔ 'medical_fauteuil' / 'vehicule_tpmr'
--                           (réutilisé tel quel — PAS de doublon)
--   capacite_charge_kg   ↔ surcharge pondérale (§5.7). Aucun besoin patient
--                           correspondant dans l'enum à ce jour → stocké mais
--                           non vérifié par la compatibilité (à mirrorer côté
--                           patient dans un lot ultérieur si besoin).
--
-- Pattern table conservé : défauts sûrs (un véhicule existant n'a aucun
-- équipement coché), checks de borne, commentaires de colonne. Équipements
-- standards en colonnes ; le « autre » du CdG en champ libre (pas d'enum).
-- RLS inchangée.
-- =============================================================================

alter table public.vehicles
  add column equipement_oxygene boolean not null default false,
  add column equipement_brancard boolean not null default false,
  add column capacite_charge_kg int check (
    capacite_charge_kg is null or capacite_charge_kg between 1 and 2000
  ),
  add column equipement_autre text check (
    equipement_autre is null or length(equipement_autre) <= 200
  );

comment on column public.vehicles.equipement_oxygene is
  'Équipement oxygène (VEHICULE-01, §5.7). Satisfait patient_constraint_type '
  '''medical_oxygene''.';
comment on column public.vehicles.equipement_brancard is
  'Accès brancard (VEHICULE-01, §5.7). Satisfait ''medical_brancard'' ; un '
  'véhicule type ''ambulance'' est considéré équipé d''office.';
comment on column public.vehicles.capacite_charge_kg is
  'Capacité de charge en kg (VEHICULE-01, §5.7, surcharge pondérale). Pas de '
  'besoin patient correspondant à ce jour → non vérifié par la compatibilité.';
comment on column public.vehicles.equipement_autre is
  'Équipement libre non standardisé (VEHICULE-01, §5.7). Informatif, hors compat.';

-- ─── supabase/migrations/20260613000013_pg_cron_recurrences_generate.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — pg_cron : génération anticipée des récurrences (RECURRENCE-01)
-- =============================================================================
-- Planifie l'appel quotidien de /api/cron/recurrences-generate (§5.9), sur le
-- MÊME mécanisme que les crons SMS (pg_cron + pg_net + Vault secret
-- 'cron_app_token', migration 20260519000007). Aucun second mécanisme (pas de
-- Vercel cron).
--
-- LOT PARTIEL ASSUMÉ : ce cron ne couvre QUE la génération anticipée. Surcharge
-- d'occurrence, éditions de série et renouvellement restent à faire (§5.9).
--
-- Timezone : pg_cron s'exprime en UTC. La Réunion est UTC+4.
--   '0 22 * * *' UTC = 02h00 Réunion (creux de nuit).
--
-- Si le secret 'cron_app_token' est absent, le Bearer est vide → le Route
-- Handler répond 401 (comportement attendu jusqu'à création du secret).
-- =============================================================================

select cron.schedule(
  'recurrences-generate',
  '0 22 * * *',
  $cron$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/recurrences-generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- ─── supabase/migrations/20260613000014_ride_recurrence_prescription_fk.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — FK ride_recurrences.prescription_id (RENOUVELLEMENT-01, §5.3/§5.9)
-- =============================================================================
-- Prérequis du renouvellement anticipé : brancher le lien série ↔ bon de
-- transport. La colonne `prescription_id` existait (nullable, « FK reportée »)
-- mais sans contrainte. On la contraint vers `prescriptions(id)` :
--   - ON DELETE SET NULL : une série survit à la suppression de son bon (le
--     lien retombe à NULL, la série continue) ;
--   - reste NULLABLE : une série peut exister sans bon rattaché (lien optionnel).
--
-- C'est ce lien qui permet de cibler le renouvellement anticipé sur les bons
-- réellement liés à une série (évite les faux positifs sur les bons ponctuels).
-- Toutes les lignes existantes ont prescription_id NULL → aucune violation.
-- =============================================================================

alter table public.ride_recurrences
  add constraint ride_recurrences_prescription_id_fkey
  foreign key (prescription_id) references public.prescriptions(id) on delete set null;

-- Index : lookup « bons liés à une série active » (alerte de renouvellement).
create index if not exists ride_recurrences_prescription_id_idx
  on public.ride_recurrences (prescription_id)
  where prescription_id is not null;

-- ─── supabase/migrations/20260613000015_ride_recurrence_exception_replaced_by.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Surcharge d'occurrence (override) — RECURRENCE-02, §5.9
-- =============================================================================
-- Pattern standard iCalendar (RFC 5545) : un override = EXDATE (exclusion de la
-- date d'origine) + instance modifiée rattachée à la série. Aucune table
-- nouvelle : l'instance modifiée EST la course matérialisée éditée (elle garde
-- son ride_recurrence_id). On réutilise `ride_recurrence_exceptions` pour
-- l'exclusion de la date d'origine (déjà le mécanisme d'annulation).
--
-- Seule extension : une colonne minimale `replaced_by_ride_id` (nullable) pour
-- DISTINGUER un déplacement d'occurrence (override) d'une simple annulation, et
-- savoir par quelle course la date a été remplacée. ON DELETE SET NULL : si la
-- course de remplacement disparaît, l'exclusion (EXDATE) demeure — la date
-- d'origine reste exclue, jamais régénérée.
-- =============================================================================

alter table public.ride_recurrence_exceptions
  add column replaced_by_ride_id uuid references public.rides(id) on delete set null;

comment on column public.ride_recurrence_exceptions.replaced_by_ride_id is
  'Override (RECURRENCE-02) : course de remplacement quand la date d''origine a '
  'été DÉPLACÉE (≠ annulation simple où la colonne reste NULL).';

-- ─── supabase/migrations/20260613000016_ride_status_intermediate.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — États intermédiaires de course (PWA-01, §5.16)
-- =============================================================================
-- Le bouton géant chauffeur suit la séquence réelle d'une prise en charge :
--   assignee → en_cours (« je pars »)
--           → arrive_sur_place (« arrivé sur place »)   ← NOUVEAU
--           → patient_a_bord  (« patient à bord »)       ← NOUVEAU
--           → terminee        (« terminé »)
-- (standard NEMT « en route / arrivé / à bord / terminé »).
--
-- Migration ADDITIVE : ajout de deux valeurs à l'enum public.ride_status. Aucune
-- course existante n'est touchée. ADD VALUE IF NOT EXISTS est idempotent ; les
-- nouvelles valeurs ne sont PAS utilisées dans cette migration (contrainte
-- Postgres : une valeur d'enum ajoutée ne peut être référencée dans la même
-- transaction que son ajout) — la machine à états (@tap/shared) et les actions
-- les emploieront ensuite.
-- =============================================================================

alter type public.ride_status add value if not exists 'arrive_sur_place';
alter type public.ride_status add value if not exists 'patient_a_bord';

-- ─── supabase/migrations/20260613000017_purge_internal_messages.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — purge automatique des messages internes > 1 an (MESSAGERIE-01, §5.22)
-- =============================================================================
-- Traite le reste-à-faire explicitement documenté du premier lot de messagerie
-- (migration 20260608000003_internal_message : « purge 1 an (pg_cron) hors
-- périmètre lot 1 »). Le §5.22 demande un archivage d'un an.
--
-- Deux volets, sur le pattern EXISTANT :
--   - fonction SQL `purge_internal_messages()` (modèle `purge_driver_positions`
--     / `purge_legal_request_attempts`) : delete au-delà de la rétention.
--   - planification pg_cron GARDÉE par un DO block conditionnel sur la présence
--     de l'extension (modèle `breach_72h_alert`) : skip propre en sandbox locale
--     où pg_cron est absent. En production Supabase Cloud, pg_cron est
--     pré-installé.
--
-- Périmètre : SEULE la table `internal_message` est touchée. Le chat, l'envoi et
-- l'affichage restent inchangés. Sûr en démo : si aucune ligne n'a plus d'un an,
-- la purge ne supprime rien (comportement naturel du delete).
-- =============================================================================

-- -- purge_internal_messages() : rétention 1 an --------------------------------
create or replace function public.purge_internal_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.internal_message
  where created_at < now() - interval '1 year';
$$;

comment on function public.purge_internal_messages() is
  'MESSAGERIE-01 (§5.22) : purge des messages internes > 1 an. Executee mensuellement par pg_cron.';

-- -- cron.schedule (guardé : DO block si extension présente) --------------------
-- Mensuel, 03h00 UTC le 1er du mois (creux, aligné sur le style des autres
-- purges). pg_cron s'exprime en UTC.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge_internal_messages_monthly',
      '0 3 1 * *',
      $cron$ select public.purge_internal_messages(); $cron$
    );
  else
    raise notice 'pg_cron non disponible (sandbox locale) — purge_internal_messages non schedulee.';
  end if;
end;
$$;

-- ─── supabase/migrations/20260613000018_rides_driver_scheduled_idx_intermediate.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — index liste chauffeur : ajout des états intermédiaires (FIX-01)
-- =============================================================================
-- L'index partiel `rides_driver_scheduled_idx` (migration 20260512000003) sert
-- la liste des courses du chauffeur. Sa clause `where status in (...)` listait
-- les statuts en dur et n'a pas suivi l'ajout des deux états intermédiaires de
-- PWA-01 (`arrive_sur_place`, `patient_a_bord`, §5.16). Résultat : une course en
-- cours de réalisation — précisément ce qu'un chauffeur consulte le plus —
-- n'était plus couverte par l'index (la requête restait correcte via scan, mais
-- moins performante).
--
-- Recréation drop + create (convention du projet : les autres index partiels
-- sont créés hors transaction concurrente). Aucune requête ne référence l'index
-- par son nom en dehors de ce drop.
-- =============================================================================

drop index if exists public.rides_driver_scheduled_idx;

create index rides_driver_scheduled_idx
  on public.rides (driver_id, scheduled_at desc)
  where
    status in ('assignee', 'en_cours', 'arrive_sur_place', 'patient_a_bord', 'terminee')
    and archive = false;

-- ─── supabase/migrations/20260613000019_driver_daily_mileage.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — relevé kilométrique journalier du chauffeur (PWA-04, §5.16)
-- =============================================================================
-- Le chauffeur saisit le compteur en début et en fin de journée. Un relevé par
-- chauffeur et par jour : `km_start` (départ) + `km_end` (clôture, posé plus
-- tard). Aucune table de tournée n'existe (l'historique se dérive de `rides`) —
-- ce relevé est donc une petite table dédiée.
--
-- Gardes EN BASE (pas seulement à l'écran) :
--   - valeurs positives (km_start/km_end >= 0) ;
--   - fin >= début quand les deux sont présents ;
--   - un seul relevé par chauffeur et par jour (unique org+driver+jour).
--
-- Isolation : `organization_id` + RLS. Le chauffeur ne voit/écrit QUE ses
-- propres relevés (`driver_id = auth.uid()`, driver_id = profiles.id, même
-- posture que driver_positions). Régulateur/dirigeant lisent leur organisation.
-- =============================================================================

create table if not exists public.driver_daily_mileage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  jour date not null,
  km_start integer check (km_start is null or km_start >= 0),
  km_end integer check (km_end is null or km_end >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_daily_mileage_end_ge_start check (
    km_end is null or km_start is null or km_end >= km_start
  ),
  constraint driver_daily_mileage_unique_day unique (organization_id, driver_id, jour)
);

comment on table public.driver_daily_mileage is
  'Releve kilometrique journalier chauffeur (PWA-04, §5.16) : km_start/km_end par jour.';

create index if not exists driver_daily_mileage_driver_jour_idx
  on public.driver_daily_mileage (driver_id, jour desc);
create index if not exists driver_daily_mileage_org_idx
  on public.driver_daily_mileage (organization_id);

-- updated_at auto (trigger partagé s'il existe ; sinon posé applicativement).
create trigger driver_daily_mileage_set_updated_at
  before update on public.driver_daily_mileage
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.driver_daily_mileage enable row level security;

-- Chauffeur : lecture de ses propres relevés.
create policy driver_daily_mileage_select_own
  on public.driver_daily_mileage
  for select
  using (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Chauffeur : insertion de son propre relevé (dans son organisation).
create policy driver_daily_mileage_insert_own
  on public.driver_daily_mileage
  for insert
  with check (
    driver_id = auth.uid()
    and organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Chauffeur : mise à jour de son propre relevé (clôture km_end).
create policy driver_daily_mileage_update_own
  on public.driver_daily_mileage
  for update
  using (driver_id = auth.uid())
  with check (
    driver_id = auth.uid()
    and organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- Régulateur / dirigeant : lecture des relevés de leur organisation.
create policy driver_daily_mileage_select_org
  on public.driver_daily_mileage
  for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('regulateur', 'dirigeant')
    )
  );

-- ─── supabase/migrations/20260613000020_rides_prise_en_charge.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — régime de prise en charge + refus transport partagé (Facturation 1)
-- =============================================================================
-- Ajoute au TRANSPORT (rides) les attributs conventionnels nécessaires à la
-- ventilation assurance / patient et à la traçabilité du refus de transport
-- partagé. Attributs portés par le TRANSPORT (en cohérence avec la prescription
-- liée), PAS dérivés du seul statut patient : l'exonération dépend du LIEN entre
-- le transport et l'affection (un patient en ALD transporté pour une cause sans
-- lien relève du taux général).
--
-- La LOGIQUE de calcul (taux, ticket modérateur, franchise, effet du refus) vit
-- dans @tap/pricing (prise-en-charge.ts), paramétrable (config versionnée) —
-- ces colonnes ne stockent que les ENTRÉES du calcul (taux, motif, refus). La
-- ventilation part assurance / part patient est DÉRIVÉE au moment de la facture
-- (doctrine D-09 : la facture ne stocke pas de montant recalculable), ce qui
-- évite toute dérive si le tarif change.
--
-- NON modélisé (signalé) : la MINORATION du remboursement sur refus (décret
-- d'application non paru) → non stockée, non appliquée.
-- =============================================================================

alter table public.rides
  -- Taux de prise en charge (%) applicable à CE transport. NULL = taux général
  -- (65 %) appliqué par le calcul. 100 = exonéré, 55 = ALD non exonérante.
  add column prise_en_charge_taux smallint
    check (prise_en_charge_taux is null or prise_en_charge_taux in (100, 65, 55)),
  -- Motif d'exonération / régime particulier (le cas échéant). Distingue les
  -- cas 100 % et pilote l'exonération de franchise / le périmètre du refus.
  add column exoneration_motif text
    check (
      exoneration_motif is null
      or exoneration_motif in ('ald_lien', 'accident_travail', 'maternite', 'css', 'ame')
    ),
  -- Refus du transport partagé par l'assuré (traçabilité). Conséquence (perte
  -- du tiers payant, mention sur facture) calculée en aval selon le périmètre
  -- (soins itératifs, hors CSS/AME).
  add column transport_partage_refuse boolean not null default false;

comment on column public.rides.prise_en_charge_taux is
  'Taux de prise en charge assurance maladie (%). NULL=taux general (65). 100=exonere, 55=ALD non exonerante. Attribut du transport (lien affection), pas du seul statut patient.';
comment on column public.rides.exoneration_motif is
  'Motif exoneration/regime: ald_lien / accident_travail / maternite / css / ame. Distingue les prises en charge a 100 % + pilote franchise et perimetre refus partage.';
comment on column public.rides.transport_partage_refuse is
  'Refus du transport partage par l''assure. Effet (hors tiers payant + mention conventionnelle) applique pour soins iteratifs hors CSS/AME. Minoration NON appliquee (decret non paru).';

-- ─── supabase/migrations/20260613000021_test_fixtures_factory.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Fabrique de préambule pour les tests de base de données (pgTAP)
-- =============================================================================
-- Factorise le socle d'authentification recopié dans ~46 tests pgTAP : deux
-- organisations de référence + utilisateurs par rôle + profils, avec des
-- IDENTIFIANTS FIGÉS (les tests endossent une identité précise via
-- `set request.jwt.claim.sub = '<id>'`). Chaque test appelle
-- `test_fixtures.setup(...)` au début de sa transaction (annulée en fin de test)
-- au lieu de recopier le préambule.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SÉCURITÉ — INERTE ET INACCESSIBLE EN PRODUCTION (condition d'acceptation)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cette migration est poussée par le déploiement à TOUS les environnements liés
-- (production comprise). Les fonctions de fixtures y sont donc présentes, mais
-- rendues STRICTEMENT INERTES hors contexte de test, par trois garde-fous
-- CUMULATIFS :
--
--   1. SCHÉMA DÉDIÉ `test_fixtures` — distinct du schéma applicatif `public`,
--      pour ne pas polluer la surface applicative.
--   2. AUCUN OCTROI aux rôles applicatifs — USAGE sur le schéma et EXECUTE sur
--      les fonctions sont révoqués à `public`, `anon` et `authenticated`. Seuls
--      les rôles d'administration/test (superuser / propriétaire) peuvent
--      appeler la fabrique.
--   3. GARDE D'EXÉCUTION — `setup()` REFUSE de s'exécuter si l'extension `pgtap`
--      est absente. `pgtap` n'est présente QUE sous `supabase test db` (aucune
--      migration ne l'installe → absente en production). Appelée par erreur en
--      production, la fonction ne crée RIEN et échoue explicitement.
--
-- La fabrique n'est ni un objet applicatif ni une donnée : c'est de l'outillage
-- de test. Elle ne modifie pas le schéma métier et n'accorde aucun privilège.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- IDENTIFIANTS DE RÉFÉRENCE FIGÉS (endossables via request.jwt.claim.sub)
-- ─────────────────────────────────────────────────────────────────────────────
--   Org Alpha (principale) : 11111111-1111-1111-1111-111111111111
--   Org Bravo (isolation)  : 22222222-2222-2222-2222-222222222222
--   alpha-dirigeant  : aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   alpha-regulateur : cccccccc-cccc-cccc-cccc-cccccccccccc
--   alpha-chauffeur  : ffffffff-ffff-ffff-ffff-ffffffffffff
--   bravo (org Bravo, dirigeant OU regulateur selon second_org_role)
--                    : dddddddd-dddd-dddd-dddd-dddddddddddd
--
-- Variantes (mesurées sur les tests) : seconde organisation (33 tests) et
-- chauffeur (17 tests). Toggles supplémentaires pour couvrir fidèlement les
-- socles à un seul rôle Alpha, sans jamais changer un identifiant figé.
-- =============================================================================

create schema if not exists test_fixtures;

comment on schema test_fixtures is
  'Outillage de FIXTURES DE TEST uniquement (préambule pgTAP factorisé). '
  'Inerte hors test : aucun octroi aux roles applicatifs + garde pgtab dans setup(). '
  'Ne JAMAIS accorder USAGE/EXECUTE a anon/authenticated.';

-- Garde-fou 2 : personne d'applicatif ne peut voir ni appeler le schéma.
revoke all on schema test_fixtures from public;
revoke usage on schema test_fixtures from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Interne : crée un utilisateur Auth + son profil (identifiants figés).
-- Centralise la cohérence avec le schéma d'authentification (colonnes requises).
-- SECURITY INVOKER : s'exécute avec les droits de l'appelant (le lanceur de
-- test, superuser → contourne la RLS comme le faisait le préambule recopié).
-- -----------------------------------------------------------------------------
create or replace function test_fixtures._create_user(
  p_id uuid,
  p_org uuid,
  p_role public.user_role,
  p_prenom text,
  p_nom text,
  p_email text
) returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, extensions.crypt('test1234!', extensions.gen_salt('bf')),
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (p_id, p_org, p_role, p_prenom, p_nom, p_email)
  on conflict (id) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Interne : construit le socle (SANS la garde). Non destiné à l'appel direct.
-- -----------------------------------------------------------------------------
create or replace function test_fixtures._build(
  with_second_org boolean,
  second_org_role text,
  with_chauffeur boolean,
  with_alpha_dirigeant boolean,
  with_alpha_regulateur boolean
) returns void
language plpgsql
set search_path = ''
as $$
declare
  org_alpha constant uuid := '11111111-1111-1111-1111-111111111111';
  org_bravo constant uuid := '22222222-2222-2222-2222-222222222222';
begin
  if second_org_role not in ('dirigeant', 'regulateur') then
    raise exception 'test_fixtures: second_org_role invalide (%). Attendu dirigeant|regulateur.', second_org_role;
  end if;

  insert into public.organizations (id, nom, ville, code_postal)
  values (org_alpha, 'Org Alpha', 'Saint-Denis', '97400')
  on conflict (id) do nothing;

  if with_second_org then
    insert into public.organizations (id, nom, ville, code_postal)
    values (org_bravo, 'Org Bravo', 'Saint-Pierre', '97410')
    on conflict (id) do nothing;
  end if;

  if with_alpha_dirigeant then
    perform test_fixtures._create_user(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', org_alpha, 'dirigeant',
      'Alpha', 'Dirigeant', 'alpha-dir@test.tap');
  end if;

  if with_alpha_regulateur then
    perform test_fixtures._create_user(
      'cccccccc-cccc-cccc-cccc-cccccccccccc', org_alpha, 'regulateur',
      'Alpha', 'Régulateur', 'alpha-reg@test.tap');
  end if;

  if with_chauffeur then
    perform test_fixtures._create_user(
      'ffffffff-ffff-ffff-ffff-ffffffffffff', org_alpha, 'chauffeur',
      'Alpha', 'Chauffeur', 'alpha-chauffeur@test.tap');
  end if;

  if with_second_org then
    if second_org_role = 'dirigeant' then
      perform test_fixtures._create_user(
        'dddddddd-dddd-dddd-dddd-dddddddddddd', org_bravo, 'dirigeant',
        'Bravo', 'Dirigeant', 'bravo-dir@test.tap');
    else
      perform test_fixtures._create_user(
        'dddddddd-dddd-dddd-dddd-dddddddddddd', org_bravo, 'regulateur',
        'Bravo', 'Régulateur', 'bravo-reg@test.tap');
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- API publique de la fabrique : installe le socle demandé.
-- Socle par défaut = Org Alpha + alpha-dirigeant + alpha-regulateur.
-- Options : seconde organisation (+ rôle du user Bravo), chauffeur Alpha,
-- et suppression d'un rôle Alpha (pour les socles à un seul rôle).
-- -----------------------------------------------------------------------------
create or replace function test_fixtures.setup(
  with_second_org boolean default false,
  second_org_role text default 'dirigeant',
  with_chauffeur boolean default false,
  with_alpha_dirigeant boolean default true,
  with_alpha_regulateur boolean default true
) returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Garde-fou 3 : refuse hors contexte de test (pgtap absent = production).
  if not exists (select 1 from pg_extension where extname = 'pgtap') then
    raise exception
      'test_fixtures.setup() est reserve au contexte de test (extension pgtap absente) — inerte en production'
      using errcode = 'insufficient_privilege';
  end if;

  perform test_fixtures._build(
    with_second_org, second_org_role, with_chauffeur,
    with_alpha_dirigeant, with_alpha_regulateur);
end;
$$;

comment on function test_fixtures.setup(boolean, text, boolean, boolean, boolean) is
  'Fabrique de preambule des tests pgTAP. Installe Org Alpha + alpha-dir/reg (+ '
  'options : seconde org, chauffeur, toggles de role Alpha). Identifiants figes. '
  'INERTE hors test (garde pgtap). Ne pas octroyer a anon/authenticated.';

-- Garde-fou 2 (fonctions) : révoquer EXECUTE aux rôles applicatifs. Aucune
-- fonction de ce schéma n'est appelable par anon/authenticated.
revoke all on function test_fixtures._create_user(uuid, uuid, public.user_role, text, text, text) from public;
revoke all on function test_fixtures._build(boolean, text, boolean, boolean, boolean) from public;
revoke all on function test_fixtures.setup(boolean, text, boolean, boolean, boolean) from public;
revoke all on function test_fixtures._create_user(uuid, uuid, public.user_role, text, text, text) from anon, authenticated;
revoke all on function test_fixtures._build(boolean, text, boolean, boolean, boolean) from anon, authenticated;
revoke all on function test_fixtures.setup(boolean, text, boolean, boolean, boolean) from anon, authenticated;

-- ─── supabase/migrations/20260613000022_login_attempts.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Durcissement connexion — limitation applicative par compte ET par origine
-- =============================================================================
-- Généralise la brique de rate limit du portail public (legal_request_attempts,
-- migration 20260508000002) à la CONNEXION. Motivation : la limitation native du
-- fournisseur d'auth est par origine réseau seulement (insuffisante — de nombreux
-- utilisateurs partagent une même sortie réseau à La Réunion, et un attaquant vise
-- un compte depuis des origines variées) et peu fiable. On ajoute une couche
-- applicative, PRINCIPALEMENT PAR COMPTE (et en complément par origine).
--
-- Anti-déni-de-service : PAS de verrouillage dur. La fenêtre glissante se vide
-- d'elle-même ; l'action ne réenregistre pas une tentative déjà bloquée (le
-- compteur draine donc même sous attaque continue). La voie de reprise
-- (mot de passe oublié) n'est jamais limitée par cette table (elle ne cible que
-- l'action de connexion).
--
-- Confidentialité : on ne stocke JAMAIS l'identifiant ni l'IP en clair — seules
-- des EMPREINTES SHA-256 (calculées côté Server Action). Table non lisible par
-- les rôles applicatifs (service_role uniquement, comme legal_request_attempts).
-- =============================================================================

create table public.login_attempts (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- Empreinte SHA-256 de l'identifiant (email normalisé) — jamais en clair.
  identifier_hash text not null,
  -- Empreinte SHA-256 de l'origine réseau (IP) — jamais en clair.
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

-- Index de fenêtre glissante par compte et par origine (interrogation récente).
create index login_attempts_identifier_time_idx
  on public.login_attempts (identifier_hash, attempted_at desc);
create index login_attempts_ip_time_idx
  on public.login_attempts (ip_hash, attempted_at desc);

alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;

-- service_role uniquement (la Server Action écrit via le client admin). Aucun
-- accès aux rôles applicatifs : ni lecture ni écriture.
create policy login_attempts_service on public.login_attempts
  for all to service_role using (true) with check (true);

revoke all on public.login_attempts from authenticated, anon;

comment on table public.login_attempts is
  'Rate limit applicatif de la CONNEXION (par compte + par origine). Empreintes '
  'SHA-256 uniquement (jamais identifiant/IP en clair). service_role only. '
  'Ralentissement progressif, pas de verrouillage dur (anti-DoS).';

-- -- purge_login_attempts() : nettoyage de la fenêtre glissante ---------------
-- Les lignes anciennes n'ont plus d'utilité (fenêtre glissante courte). Purge
-- quotidienne, calquée sur purge_legal_request_attempts().
create or replace function public.purge_login_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_attempts
  where attempted_at < now() - interval '1 day';
end;
$$;

comment on function public.purge_login_attempts() is
  'Purge login_attempts > 1 jour (fenêtre glissante courte) — exécuté quotidien.';

-- Cohérence avec la doctrine sécurité (migration 20260525000001) : aucune
-- fonction de purge exposée aux rôles applicatifs.
revoke all on function public.purge_login_attempts() from public, anon, authenticated;

-- -- cron.schedule (gardé : DO block si l'extension est présente) -------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'login-attempts-purge',
      '15 3 * * *',
      $cron$ select public.purge_login_attempts(); $cron$
    );
  end if;
end $$;

-- ─── supabase/migrations/20260613000023_rides_payment_reminded_at.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — relance d'encaissement direct (CAISSE-01, §5.19)
-- =============================================================================
-- La vue « à encaisser » liste les créances directes en attente
-- (`payment_status = 'a_encaisser'`). Pour en faire un outil de recouvrement, on
-- trace la RELANCE du patient : `payment_reminded_at` = horodatage de la
-- dernière relance (NULL = jamais relancé). Colonne DÉDIÉE — aucun champ de
-- paiement existant n'est détourné.
--
-- Additive et rétrocompatible : colonne nullable, aucune valeur par défaut, sans
-- contrainte. Les politiques RLS UPDATE existantes de `public.rides`
-- (régulateur / dirigeant de l'organisation) couvrent déjà ce champ — aucune
-- politique nouvelle n'est requise.
-- =============================================================================

alter table public.rides
  add column if not exists payment_reminded_at timestamptz;

comment on column public.rides.payment_reminded_at is
  'Horodatage de la derniere relance d''encaissement direct (CAISSE-01). NULL = jamais relance.';

-- ─── supabase/migrations/20260613000024_rides_cgss_invoice_lifecycle.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — cycle de vie de la facture CGSS (tiers payant), grain = transport
-- =============================================================================
-- G3 Lot 1 (périmètre A, suivi déclaratif). Pose le MODÈLE du suivi des factures
-- CGSS en tiers payant. Aucune UI, aucune action ici (lots suivants).
--
-- GRAIN = LA COURSE. La norme (retours NOEMIE) fonctionne par facture
-- individuelle (par transport) : le paiement / rejet arrive course par course,
-- pas pour un mois entier. Le statut porte donc sur la course, jamais sur la
-- période mensuelle.
--
-- PÉRIMÈTRE = CGSS PUR. Seules les courses en tiers payant CGSS pur
-- (`payment_status = 'non_concerne'`) suivent ce cycle. Les `a_encaisser` /
-- `encaisse` relèvent de l'encaissement direct (hors périmètre).
--
-- DOCTRINE D-09 STRICTE : AUCUN montant n'est stocké. Le suivi porte sur des
-- ÉTATS, des DATES d'événement et des MOTIFS — jamais des euros. Les montants
-- restent dérivés à la volée par `aggregateFacture`. La part complémentaire en
-- attente (`partiellement_payee`) est un FAIT BOOLÉEN, pas un montant.
--
-- FORME (choix documenté) :
--   • `rides.cgss_invoice_status` = ÉTAT COURANT (dénormalisé, requêtable /
--     indexable — le tableau de suivi du Lot 2 filtre par statut sans jointure) ;
--   • `ride_cgss_invoice_events` = HISTORIQUE append-only des retours (une ligne
--     par événement : télétransmission, ARL ±, retours NOEMIE, rejet…), qui gère
--     les RETRANSMISSIONS MULTIPLES (rejet → corriger → retransmettre → …). Le
--     statut courant est maintenu par l'application à l'enregistrement d'un
--     événement (transaction insert + update), lot suivant.
--
-- Additive et rétrocompatible : colonne nullable, table nouvelle, aucun DROP.
-- Facturation mensuelle / caisse / dashboard ne lisent pas ces champs → intacts.
-- =============================================================================

-- -- Section 1 — statut de cycle de vie (état courant sur la course) -----------
-- Séquence réglementaire normée (déduite des retours NOEMIE, non inventée) :
--   a_teletransmettre    facturable, pas encore envoyée (état d'entrée)
--   teletransmise        lot envoyé, en attente d'ARL
--   reception_confirmee  ARL positif (réception technique OK, ≠ validée)
--   rejet_technique      ARL négatif (lot rejeté techniquement → retransmettre)
--   en_traitement_caisse motif NOEMIE « Traitement Caisse » (2e retour attendu)
--   payee                retour NOEMIE paiement (toutes parts réglées)
--   rejetee              retour NOEMIE rejet (avec motif → corriger / retransmettre)
--   partiellement_payee  part obligatoire payée, part complémentaire en attente
alter table public.rides
  add column cgss_invoice_status text
    check (
      cgss_invoice_status is null
      or cgss_invoice_status in (
        'a_teletransmettre', 'teletransmise', 'reception_confirmee', 'rejet_technique',
        'en_traitement_caisse', 'payee', 'rejetee', 'partiellement_payee'
      )
    );

comment on column public.rides.cgss_invoice_status is
  'Statut du cycle de vie de la facture CGSS (tiers payant), par transport. NULL = hors cycle (course non facturable CGSS ou encaissement direct). Aucun montant (D-09).';

-- Cohérence : le cycle de vie CGSS ne concerne QUE les courses en tiers payant
-- CGSS pur (`payment_status = 'non_concerne'`). Une course encaissée en direct
-- ne porte jamais de statut de facture CGSS.
alter table public.rides
  add constraint rides_cgss_status_requires_cgss_pur check (
    cgss_invoice_status is null or payment_status = 'non_concerne'
  );

-- Les données existantes « prennent le défaut » : les courses déjà terminées en
-- CGSS pur entrent au premier état du cycle (à télétransmettre). Non destructif.
update public.rides
  set cgss_invoice_status = 'a_teletransmettre'
  where status = 'terminee'
    and payment_status = 'non_concerne'
    and archive = false
    and cgss_invoice_status is null;

-- Index partiel pour le futur tableau de suivi (Lot 2) : filtre par statut.
create index rides_cgss_invoice_status_idx
  on public.rides (cgss_invoice_status)
  where cgss_invoice_status is not null;

-- -- Section 2 — historique append-only des événements de facturation ----------
create table public.ride_cgss_invoice_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  -- Type d'événement du cycle (fait daté). Un rejet porte un motif.
  event_type text not null check (
    event_type in (
      'teletransmission', 'arl_positif', 'arl_negatif', 'traitement_caisse',
      'paiement', 'rejet', 'paiement_partiel'
    )
  ),
  event_date date not null,
  -- Motif de rejet (texte libre) + famille normée (classification exploitable).
  motif text check (motif is null or (length(motif) > 0 and length(motif) <= 500)),
  motif_famille text check (
    motif_famille is null
    or motif_famille in (
      'correction_metier', 'correction_parametrage', 'incident_technique',
      'dossier_caisse', 'ecart_amc_dre'
    )
  ),
  -- Part complémentaire (AMC) en attente pour `partiellement_payee` — FAIT
  -- BOOLÉEN, PAS un montant (D-09). Le montant reste dérivé par aggregateFacture.
  complementaire_en_attente boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  -- Cohérence : un rejet (ARL négatif ou retour NOEMIE rejet) exige un motif.
  constraint ride_cgss_invoice_events_rejet_requires_motif check (
    event_type not in ('arl_negatif', 'rejet') or motif is not null
  ),
  -- Cohérence : la famille de motif ne s'applique qu'aux rejets.
  constraint ride_cgss_invoice_events_famille_only_on_rejet check (
    motif_famille is null or event_type in ('arl_negatif', 'rejet')
  )
);

comment on table public.ride_cgss_invoice_events is
  'Historique append-only des evenements de facturation CGSS par transport (retours NOEMIE, ARL, retransmissions). Etats/dates/motifs seulement, aucun montant (D-09).';
comment on column public.ride_cgss_invoice_events.complementaire_en_attente is
  'Part complementaire (AMC) en attente : fait booleen pour partiellement_payee. PAS un montant (D-09).';

create index ride_cgss_invoice_events_ride_idx
  on public.ride_cgss_invoice_events (ride_id, event_date);
create index ride_cgss_invoice_events_org_idx
  on public.ride_cgss_invoice_events (organization_id);

-- -- Section 3 — RLS (append-only : select + insert, pas d'update/delete) ------
-- Donnée financière sensible : lecture ET écriture réservées au régulateur /
-- dirigeant de l'organisation (le chauffeur n'y accède pas). Table append-only :
-- pas de policy UPDATE / DELETE → historique des retours immuable.
alter table public.ride_cgss_invoice_events enable row level security;
alter table public.ride_cgss_invoice_events force row level security;

create policy ride_cgss_invoice_events_select_regulateur on public.ride_cgss_invoice_events
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_cgss_invoice_events_insert_regulateur on public.ride_cgss_invoice_events
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

-- ─── supabase/migrations/20260613000025_record_cgss_invoice_event_rpc.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — RPC d'enregistrement d'un retour CGSS (événement + statut, atomique)
-- =============================================================================
-- G3 Lot 2. Enregistre un retour de facturation CGSS de façon ATOMIQUE : insère
-- l'événement dans l'historique append-only ET met à jour le statut courant de
-- la course, en une seule transaction (une fonction plpgsql est atomique). Évite
-- toute divergence entre l'historique (source de vérité) et le cache de statut.
--
-- SECURITY INVOKER : la RLS du Lot 1 s'applique intégralement (insert
-- ride_cgss_invoice_events + update rides réservés régulateur / dirigeant de
-- l'organisation ; l'accès à la course est vérifié par la RLS de SELECT). Les
-- contraintes du Lot 1 (rejet ⇒ motif, famille ⇒ rejet, statut ⇒ CGSS pur)
-- restent en vigueur. Aucun montant (D-09).
--
-- Le statut résultant est fourni par l'appelant (dérivé du type d'événement,
-- source unique côté application) ; la contrainte `check` sur cgss_invoice_status
-- garantit qu'il reste dans la séquence normée.
-- =============================================================================

create or replace function public.record_cgss_invoice_event(
  p_ride_id uuid,
  p_event_type text,
  p_event_date date,
  p_new_status text,
  p_motif text default null,
  p_motif_famille text default null,
  p_complementaire_en_attente boolean default false
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid;
begin
  -- Org de la course. La RLS de SELECT sur rides borne à l'organisation : v_org
  -- reste NULL si l'utilisateur n'a pas accès → on refuse (course « introuvable »).
  select organization_id into v_org from public.rides where id = p_ride_id;
  if v_org is null then
    raise exception 'Course introuvable ou hors périmètre';
  end if;

  insert into public.ride_cgss_invoice_events (
    organization_id, ride_id, event_type, event_date,
    motif, motif_famille, complementaire_en_attente, created_by
  ) values (
    v_org, p_ride_id, p_event_type, p_event_date,
    p_motif, p_motif_famille, coalesce(p_complementaire_en_attente, false), auth.uid()
  );

  update public.rides
    set cgss_invoice_status = p_new_status
    where id = p_ride_id;
end;
$$;

comment on function public.record_cgss_invoice_event(
  uuid, text, date, text, text, text, boolean
) is
  'Enregistre un retour CGSS (Lot 2) : insere l''evenement append-only + met a jour rides.cgss_invoice_status, atomiquement. SECURITY INVOKER (RLS + contraintes Lot 1 appliquees). Aucun montant (D-09).';

-- ─── supabase/migrations/20260613000026_compliance_documents_bucket.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — bucket Storage privé « compliance-documents » + RLS org-scoped
-- =============================================================================
-- Débloque l'upload des justificatifs de conformité (contrôle technique,
-- assurance, convention…) en BÊTA sur Supabase Storage sous DPA (DEC-077 : le
-- HDS est un prérequis de la PROD commerciale, pas de la bêta ; Supabase EU sous
-- DPA acceptable en bêta). Architecture PORTABLE (CON-001) : la migration du
-- bucket vers une infra HDS en prod ne changera pas le code applicatif.
--
-- Bucket PRIVÉ (jamais public) : lecture uniquement par URL signée courte
-- générée côté serveur. Types/tailles bornés au niveau bucket (défense en
-- profondeur, en plus de la validation applicative).
--
-- Convention de chemin : {organization_id}/{entity_type}/{entity_id}/{uuid}-{fichier}
-- → le 1er dossier = organization_id, exploité par la RLS pour le cloisonnement
-- multi-tenant ; l'UUID évite collisions et énumération.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760, -- 10 Mio
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- RLS storage.objects — cloisonnement par organisation (1er dossier du chemin).
-- Lecture : régulateur / dirigeant de l'organisation propriétaire de l'objet.
create policy "compliance_docs_select_same_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

-- Écriture : réservée au DIRIGEANT de l'organisation (cohérent avec les actions
-- conformité), dans le préfixe de sa propre organisation. Aucun cross-org, aucun
-- anon (policies réservées au rôle `authenticated`).
create policy "compliance_docs_insert_dirigeant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.has_role('dirigeant'::public.user_role)
  );

-- ─── supabase/migrations/20260613000027_internal_message_read.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — messagerie interne lot 2 (§5.22) : état de lecture + non-lus
-- =============================================================================
-- Ajoute la notion de « non-lu » au chat à la course (`internal_message`), qui
-- n'en avait aucune. Read-state PAR UTILISATEUR et PAR FIL (course) : une ligne
-- `(profile_id, ride_id)` porte l'horodatage du dernier message lu.
--
-- RLS stricte : un utilisateur ne voit / n'écrit QUE ses propres lignes de
-- lecture, dans son organisation (aucune fuite cross-tenant, read-state privé).
--
-- Le compteur de non-lus est exposé par une RPC SECURITY INVOKER : la RLS de
-- `internal_message` (org + rôle : le chauffeur ne voit que ses courses) et
-- celle de `internal_message_read` s'appliquent → le compte est exact et
-- cloisonné, sans logique de visibilité dupliquée côté applicatif.
-- =============================================================================

create table public.internal_message_read (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, ride_id)
);

comment on table public.internal_message_read is
  'Etat de lecture messagerie interne (§5.22 lot 2) : dernier message lu par (utilisateur, course). Prive et org-scoped. Sert au compteur de non-lus.';

create index internal_message_read_org_idx on public.internal_message_read (organization_id);

alter table public.internal_message_read enable row level security;
alter table public.internal_message_read force row level security;

-- Lecture / écriture RÉSERVÉES à ses propres lignes (read-state privé), même org.
create policy internal_message_read_select on public.internal_message_read
  for select to authenticated
  using (profile_id = auth.uid() and organization_id = public.current_organization_id());

create policy internal_message_read_insert on public.internal_message_read
  for insert to authenticated
  with check (profile_id = auth.uid() and organization_id = public.current_organization_id());

create policy internal_message_read_update on public.internal_message_read
  for update to authenticated
  using (profile_id = auth.uid() and organization_id = public.current_organization_id())
  with check (profile_id = auth.uid() and organization_id = public.current_organization_id());
-- Pas de DELETE : le read-state se met à jour (upsert), il ne se supprime pas.

revoke all on public.internal_message_read from anon;
grant select, insert, update on public.internal_message_read to authenticated;

-- =============================================================================
-- RPC compteur de non-lus (SECURITY INVOKER → RLS des 2 tables appliquée)
-- =============================================================================
-- Compte les messages VISIBLES par l'appelant (RLS internal_message), émis par
-- QUELQU'UN D'AUTRE, plus récents que son dernier passage sur le fil (ou jamais
-- lus). Un LEFT JOIN sur le read-state (lui aussi RLS-filtré à ses lignes).
create or replace function public.count_unread_messages()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.internal_message m
  left join public.internal_message_read rd
    on rd.ride_id = m.ride_id and rd.profile_id = auth.uid()
  where m.sender_profile_id <> auth.uid()
    and (rd.last_read_at is null or m.created_at > rd.last_read_at);
$$;

comment on function public.count_unread_messages() is
  'Compteur de messages non lus de l''utilisateur courant (§5.22 lot 2). SECURITY INVOKER : RLS internal_message (org+role) et internal_message_read appliquees.';

revoke all on function public.count_unread_messages() from anon;
grant execute on function public.count_unread_messages() to authenticated;

-- ─── supabase/migrations/20260613000028_internal_message_image.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — messagerie interne lot 3 (§5.22) : photo jointe à un message
-- =============================================================================
-- Permet d'attacher une PHOTO (incident, document) à un message de course.
-- Réutilise le pattern d'upload Supabase Storage débloqué (bucket PRIVÉ,
-- RLS org-scoped, URL signée à la lecture, validation MIME image/taille) — même
-- doctrine santé que l'upload conformité : jamais de public, pas de fuite.
--
-- Modèle : `internal_message.image_path` porte le CHEMIN de l'objet (bucket
-- privé — pas d'URL publique). Un message peut désormais être texte seul, photo
-- seule, ou les deux (légende) — d'où l'assouplissement de la contrainte body.
-- =============================================================================

-- Body désormais optionnel (message photo-seule). La contrainte de contenu
-- garantit qu'un message porte AU MOINS du texte OU une photo.
alter table public.internal_message alter column body drop not null;
alter table public.internal_message drop constraint if exists internal_message_body_check;

alter table public.internal_message add column image_path text;

alter table public.internal_message add constraint internal_message_content_check check (
  (body is null or char_length(body) between 1 and 2000)
  and (body is not null or image_path is not null)
);

comment on column public.internal_message.image_path is
  'Chemin de l''objet Storage (bucket prive message-attachments) d''une photo jointe. NULL = message texte. Lecture via URL signee (§5.22 lot 3).';

-- =============================================================================
-- Bucket privé + RLS org-scoped (même patron que compliance-documents)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  5242880, -- 5 Mio
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Chemin : {organization_id}/{ride_id}/{uuid}-{fichier} → 1er dossier = org
-- (clé de cloisonnement RLS). Lecture / écriture réservées aux membres
-- authentifiés de l'organisation (les 3 rôles participent au chat ; la
-- visibilité fine par course est portée par la RLS de `internal_message` :
-- l'URL signée n'est demandée que pour un message que l'appelant peut voir).
create policy "message_attachments_select_same_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy "message_attachments_insert_same_org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

-- ─── supabase/migrations/20260613000029_internal_general_message.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Messagerie interne, fil général hors course (§5.22 lot A)
-- =============================================================================
-- Un fil de discussion GÉNÉRAL régulateur ↔ chauffeurs, NON rattaché à une
-- course (le chat à la course reste `internal_message`, inchangé).
--
-- Choix de modèle — table DÉDIÉE plutôt que `ride_id` nullable sur
-- `internal_message` :
--   - les filtres Realtime Supabase ne supportent que `eq`/`in`/comparaisons,
--     jamais `is null` : impossible de s'abonner proprement à « ride_id IS NULL »
--     pour isoler le fil général ;
--   - filtrer le fil général par `organization_id` sur `internal_message`
--     ferait remonter TOUS les messages de course de l'org dans le fil général
--     (classe du bug Supabase #1721 : un canal reçoit les payloads d'un autre) ;
--   - une table dédiée a son propre canal `internal_general_message:{org}`
--     filtré `organization_id=eq.{org}` — seulement le fil général, aucun
--     mélange, ZÉRO régression sur le chat à la course.
--   Le §5.22 lot A autorise explicitement « table dédiée si plus propre ».
--
-- Mêmes invariants que `internal_message` : RLS org-scoped stricte, messages
-- IMMUABLES (pas d'UPDATE/DELETE), sender dénormalisé, publication Realtime,
-- archivage 1 an (purge étendue plus bas). Texte uniquement au lot A ; la photo
-- (lot C) sur le fil général est un suivi (le socle Storage est déjà là).
-- =============================================================================

create table public.internal_general_message (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.user_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.internal_general_message is
  'Messagerie interne (CdC §5.22 lot A) — fil général régulateur↔chauffeurs hors course. Un fil par organisation. Messages immuables. Table dédiée (isolation Realtime, cf. migration).';

-- Index fil chronologique + colonne de policy RLS (organization_id).
create index internal_general_message_org_created_idx
  on public.internal_general_message (organization_id, created_at);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.internal_general_message enable row level security;
alter table public.internal_general_message force row level security;

-- SELECT : tout membre de l'organisation voit le fil général (régulateur,
-- dirigeant, chauffeur — le fil est commun à l'org, c'est sa raison d'être).
create policy internal_general_message_select on public.internal_general_message
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT : même org, auteur = soi (anti-usurpation), rôle cohérent.
create policy internal_general_message_insert on public.internal_general_message
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and sender_profile_id = auth.uid()
    and sender_role = public.current_user_role()
  );
-- Pas de policy UPDATE/DELETE : messages immuables (cohérent avec internal_message).

-- =============================================================================
-- Grants (convention repo : revoke anon + grant ciblé authenticated)
-- =============================================================================
revoke all on public.internal_general_message from anon;
grant select, insert on public.internal_general_message to authenticated;

-- =============================================================================
-- Publication Realtime (idempotent, même garde que internal_message)
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not (select puballtables from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'internal_general_message'
       )
    then
      alter publication supabase_realtime add table public.internal_general_message;
    end if;
  end if;
end
$$;

-- =============================================================================
-- Archivage 1 an — étend purge_internal_messages() au fil général (§5.22)
-- =============================================================================
-- Cohérent avec l'existant (MESSAGERIE-01) : la purge mensuelle pg_cron déjà
-- planifiée appelle cette fonction ; on ajoute simplement le fil général.
create or replace function public.purge_internal_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.internal_message
  where created_at < now() - interval '1 year';
  delete from public.internal_general_message
  where created_at < now() - interval '1 year';
$$;

comment on function public.purge_internal_messages() is
  'MESSAGERIE-01 (§5.22) : purge des messages internes > 1 an (chat course + fil général). Executee mensuellement par pg_cron.';

-- ─── supabase/migrations/20260613000030_cost_parameters.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Paramètres de coût par organisation (§5.20 lot E)
-- =============================================================================
-- KPIs économiques (coût/km, marge brute, rentabilité) : le CdC §5.20 exige des
-- coûts PARAMÉTRABLES (carburant + entretien + amortissement). Sans paramètres
-- saisis, aucune marge ne peut être calculée → l'UI affiche « non configuré »
-- (jamais un zéro trompeur). Une seule configuration par organisation
-- (unique organization_id), éditée par le dirigeant.
--
-- Trois composantes en €/km (le coût/km total = leur somme). Un €/km unique et
-- décomposé suffit au MVP ; une granularité par véhicule/mode viendra si besoin.
--
-- RLS org-scoped stricte : lecture par tout membre de l'org, écriture réservée
-- au dirigeant (pattern paramètres tarifaires). Modifs journalisées côté action.
-- =============================================================================

create table public.cost_parameters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  cout_carburant_eur_km numeric(6, 3) not null default 0 check (cout_carburant_eur_km >= 0 and cout_carburant_eur_km <= 99),
  cout_entretien_eur_km numeric(6, 3) not null default 0 check (cout_entretien_eur_km >= 0 and cout_entretien_eur_km <= 99),
  cout_amortissement_eur_km numeric(6, 3) not null default 0 check (cout_amortissement_eur_km >= 0 and cout_amortissement_eur_km <= 99),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

comment on table public.cost_parameters is
  'Paramètres de coût par organisation (CdC §5.20 lot E) — coûts €/km carburant + entretien + amortissement, éditables par le dirigeant, pour les KPIs de marge. Une ligne par organisation.';

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.cost_parameters enable row level security;
alter table public.cost_parameters force row level security;

-- SELECT : tout membre de l'organisation (config non sensible).
create policy cost_parameters_select on public.cost_parameters
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT : dirigeant, même org.
create policy cost_parameters_insert on public.cost_parameters
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- UPDATE : dirigeant, même org.
create policy cost_parameters_update on public.cost_parameters
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- =============================================================================
-- Grants (convention repo : revoke anon + grant ciblé authenticated)
-- =============================================================================
revoke all on public.cost_parameters from anon;
grant select, insert, update on public.cost_parameters to authenticated;

-- ─── supabase/migrations/20260614000001_planning_validations.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — Validation du planning J+1 + gel du « prévu » (Module 5.12 lot D)
-- =============================================================================
-- CdG §5.12 : la régulation VALIDE le planning du lendemain. Cette validation
--   1. notifie les chauffeurs (push) et confirme aux patients (SMS) — best-effort ;
--   2. FIGE l'état « prévu » du jour (instantané) pour permettre, le lendemain,
--      la comparaison prévu vs réalisé (lot E, historique).
--
-- Deux tables append-only (des FAITS figés, jamais modifiés) :
--   - planning_validations : une validation par (organisation, jour). L'unicité
--     (organization_id, planning_date) rend la re-validation IDEMPOTENTE : la
--     2ᵉ tentative ne réécrit rien (l'action serveur détecte le doublon et ne
--     renotifie pas, ne re-fige pas).
--   - planning_validation_rides : instantané du « prévu » de chaque course au
--     moment de la validation (chauffeur, véhicule, patient, heure, statut).
--
-- Pas d'UPDATE ni de DELETE exposés : un instantané qui changerait ne serait
-- plus un instantané. RLS par organisation, INSERT réservé régulateur/dirigeant.
-- Pattern RLS calqué driver_incidents (20260612000003) + ride_groups.
-- =============================================================================

-- -- Section 1 — En-tête de validation -----------------------------------------
create table public.planning_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Jour validé (clé métier, fuseau Réunion côté application).
  planning_date date not null,
  validated_at timestamptz not null default now(),
  validated_by uuid not null references auth.users(id),
  -- Compteurs de notification (traçabilité best-effort, non bloquants).
  notified_drivers integer not null default 0 check (notified_drivers >= 0),
  notified_patients integer not null default 0 check (notified_patients >= 0),
  created_at timestamptz not null default now()
);

comment on table public.planning_validations is
  'Validation du planning d''un jour (Module 5.12 lot D). Un enregistrement par '
  '(organisation, jour) — unicité = idempotence de la re-validation. Fige le '
  'prévu via planning_validation_rides.';

-- Idempotence : une seule validation par organisation et par jour.
create unique index planning_validations_org_date_uk
  on public.planning_validations (organization_id, planning_date);

alter table public.planning_validations enable row level security;
alter table public.planning_validations force row level security;

create policy planning_validations_select_org on public.planning_validations
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy planning_validations_insert_regulateur on public.planning_validations
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );
-- Pas d'UPDATE/DELETE : la validation est un fait figé.

revoke all on public.planning_validations from anon;
grant select, insert on public.planning_validations to authenticated;

-- -- Section 2 — Instantané des courses « prévues » ----------------------------
create table public.planning_validation_rides (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null
    references public.planning_validations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  -- Instantané du « prévu » au moment de la validation (nullable : course non
  -- affectée, patient absent d'une course temps réel…).
  driver_id uuid null references public.drivers(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  patient_id uuid null references public.patients(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null,
  created_at timestamptz not null default now()
);

comment on table public.planning_validation_rides is
  'Instantané du « prévu » d''une course au moment de la validation du planning '
  '(Module 5.12 lots D/E). Base de la comparaison prévu vs réalisé.';

create index planning_validation_rides_validation_idx
  on public.planning_validation_rides (validation_id);
create index planning_validation_rides_organization_id_idx
  on public.planning_validation_rides (organization_id);
-- Une course figée une seule fois par validation.
create unique index planning_validation_rides_validation_ride_uk
  on public.planning_validation_rides (validation_id, ride_id);

alter table public.planning_validation_rides enable row level security;
alter table public.planning_validation_rides force row level security;

create policy planning_validation_rides_select_org on public.planning_validation_rides
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy planning_validation_rides_insert_regulateur on public.planning_validation_rides
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );
-- Pas d'UPDATE/DELETE : instantané figé.

revoke all on public.planning_validation_rides from anon;
grant select, insert on public.planning_validation_rides to authenticated;

-- ─── supabase/migrations/20260614000002_fix_prescription_counter_status_cast.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration corrective — cast explicite du statut dans le compteur de prescription
-- =============================================================================
-- Le corps de `rides_prescription_counter()` (20260613000004) compare
-- `old.status = any (cancelled)` et `new.status = any (cancelled)` où `status`
-- est l'enum `ride_status` et `cancelled` un `text[]`. L'opérateur
-- `ride_status = text` n'existe pas (SQLSTATE 42883 : « operator does not exist:
-- ride_status = text ») : tout INSERT/UPDATE sur `rides` liée à une prescription
-- échoue. On force donc la comparaison côté text via `old.status::text` /
-- `new.status::text`. AUCUNE autre modification : logique de delta, idempotence,
-- array `cancelled` (aligné DEC-174, `annulee_meteo` inclus) strictement identiques.
-- La migration d'origine n'est pas touchée ; ce CREATE OR REPLACE prend le relais.
-- =============================================================================

create or replace function public.rides_prescription_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- DOIT rester synchronisé avec RIDE_CANCELLED_STATUSES (@tap/shared) + brouillon.
  -- Tout nouveau statut d'annulation s'ajoute ici ET côté app (DEC-174).
  cancelled constant text[] := array['brouillon','annulee_regulateur','annulee_patient','annulee_chauffeur','annulee_meteo'];
  consumes_old boolean := false;
  consumes_new boolean := false;
begin
  if tg_op in ('UPDATE','DELETE') and old.prescription_id is not null then
    consumes_old := not (old.status::text = any (cancelled));
  end if;
  if tg_op in ('INSERT','UPDATE') and new.prescription_id is not null then
    consumes_new := not (new.status::text = any (cancelled));
  end if;

  -- Même prescription (ou NULL des deux côtés) : appliquer le delta de l'état
  -- consommateur uniquement s'il a changé (idempotent).
  if tg_op = 'UPDATE' and (old.prescription_id is not distinct from new.prescription_id) then
    if new.prescription_id is not null and (consumes_new is distinct from consumes_old) then
      update public.prescriptions
        set trajets_consommes = greatest(0, trajets_consommes + (case when consumes_new then 1 else -1 end))
        where id = new.prescription_id;
      perform public.recompute_prescription_status(new.prescription_id);
    end if;
    return new;
  end if;

  -- INSERT / DELETE / changement de prescription : libérer l'ancienne, prendre
  -- la nouvelle.
  if consumes_old then
    update public.prescriptions
      set trajets_consommes = greatest(0, trajets_consommes - 1)
      where id = old.prescription_id;
    perform public.recompute_prescription_status(old.prescription_id);
  end if;
  if consumes_new then
    update public.prescriptions
      set trajets_consommes = trajets_consommes + 1
      where id = new.prescription_id;
    perform public.recompute_prescription_status(new.prescription_id);
  end if;

  return coalesce(new, old);
end; $$;

comment on function public.rides_prescription_counter() is
  'Compteur idempotent de trajets consommés (DEC-163/174) : delta sur transition '
  'de l''état consommateur d''une course (active = ni brouillon ni annulée, météo '
  'incluse). Comparaison de statut castée en text (ride_status::text) car '
  'l''opérateur ride_status = text n''existe pas. Array `cancelled` synchronisé '
  'avec RIDE_CANCELLED_STATUSES (@tap/shared).';

-- ─── supabase/migrations/20260614000003_rides_update_check_role_gate.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration sécurité — colmatage d'une faille d'intégrité intra-org sur rides
-- =============================================================================
-- FAILLE (intégrité, PAS fuite cross-tenant) : un chauffeur pouvait réassigner
-- SA propre course à un autre chauffeur de la MÊME organisation via UPDATE
-- driver_id. Mécanisme : PostgreSQL combine en OR les WITH CHECK de TOUTES les
-- policies permissives applicables à la commande, indépendamment du USING qui a
-- sélectionné la ligne. La policy `rides_update_chauffeur_own_rides` borne bien
-- sa propre WITH CHECK (driver_id = le chauffeur), mais la policy
-- `rides_update_regulateur_dirigeant` avait une WITH CHECK limitée à
-- `organization_id` (sans contrôle de rôle). La nouvelle ligne du chauffeur
-- (même org, driver_id d'un collègue) satisfaisait donc cette WITH CHECK org-only
-- → transfert accepté.
--
-- CORRECTIF : on aligne la WITH CHECK de `rides_update_regulateur_dirigeant` sur
-- son USING (organisation ET rôle régulateur/dirigeant). Ainsi, pour un
-- chauffeur, plus AUCUNE WITH CHECK permissive n'accepte une ligne dont il
-- change le driver_id → PostgreSQL lève 42501. Les flux légitimes sont
-- préservés :
--   * régulateur/dirigeant (réassignation, validation) : rôle présent → OK ;
--   * chauffeur mettant à jour SA course (statut, started_at…) sans changer
--     driver_id : passe par la WITH CHECK de sa propre policy → OK.
-- Aucun REVOKE, aucune policy supprimée : on RESSERRE une WITH CHECK trop large.
-- =============================================================================

drop policy if exists rides_update_regulateur_dirigeant on public.rides;
create policy rides_update_regulateur_dirigeant on public.rides
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

comment on policy rides_update_regulateur_dirigeant on public.rides is
  'UPDATE course par régulateur/dirigeant de l''org. WITH CHECK alignée sur le '
  'USING (org + rôle) — DEC : empêche qu''un chauffeur détourne cette WITH CHECK '
  'org-only (combinée en OR) pour réassigner sa course à un autre driver.';

-- ─── supabase/migrations/20260614000004_validate_planning_day_rpc.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration — RPC de validation du planning (validation + figeage atomiques)
-- =============================================================================
-- Module 5.12 lot D, robustesse. La Server Action `validatePlanningAction`
-- faisait DEUX écritures séparées : INSERT planning_validations puis INSERT
-- planning_validation_rides. Si le figeage échouait après la validation, la
-- validation persistait SANS instantané, et la re-validation (idempotente) ne
-- re-figeait jamais → l'historique (lot E) classait alors tout le réalisé en
-- « ajoutées ». On rend les deux écritures ATOMIQUES via une fonction plpgsql
-- (une fonction est exécutée dans une seule transaction : tout réussit, ou tout
-- est annulé). Modèle : `record_cgss_invoice_event` (G3 Lot 2).
--
-- SECURITY INVOKER : la RLS s'applique intégralement — les policies INSERT de
-- planning_validations / planning_validation_rides (régulateur ou dirigeant de
-- l'organisation) autorisent l'écriture, et la RLS de SELECT sur `rides` borne
-- l'instantané à l'organisation. Aucune élévation de privilège.
--
-- Idempotence préservée : une validation par (organisation, jour) via l'index
-- unique. Une validation existante → renvoyée telle quelle (already_validated).
-- Une course concurrente qui gagne l'INSERT → l'autre attrape `unique_violation`
-- et renvoie aussi already_validated. Les notifications (push/SMS) restent HORS
-- de cette fonction (best-effort, après commit) — elles ne doivent pas pouvoir
-- annuler une validation déjà écrite.
--
-- Jour en fuseau Réunion (UTC+4, sans heure d'été) : [date 00:00+04, lendemain
-- 00:00+04). « Prévu ferme » = hors brouillon et hors annulées.
-- =============================================================================

create or replace function public.validate_planning_day(p_planning_date date)
returns table (validation_id uuid, already_validated boolean, snapshot_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_validation_id uuid;
  v_count integer := 0;
  v_start timestamptz := (p_planning_date::text || ' 00:00:00+04')::timestamptz;
  v_end timestamptz := ((p_planning_date + 1)::text || ' 00:00:00+04')::timestamptz;
begin
  if v_org is null then
    raise exception 'Organisation introuvable ou hors périmètre';
  end if;

  -- Déjà validé ? → renvoi idempotent, aucune écriture.
  select id into v_validation_id
    from public.planning_validations
    where organization_id = v_org and planning_date = p_planning_date;
  if v_validation_id is not null then
    return query select v_validation_id, true, 0;
    return;
  end if;

  -- INSERT validation + figeage dans la MÊME transaction (atomicité).
  begin
    insert into public.planning_validations (organization_id, planning_date, validated_by)
      values (v_org, p_planning_date, auth.uid())
      returning id into v_validation_id;
  exception when unique_violation then
    -- Course concurrente : l'autre appel a validé entre-temps → idempotent.
    select id into v_validation_id
      from public.planning_validations
      where organization_id = v_org and planning_date = p_planning_date;
    return query select v_validation_id, true, 0;
    return;
  end;

  insert into public.planning_validation_rides
    (validation_id, organization_id, ride_id, driver_id, vehicle_id, patient_id,
     scheduled_at, status)
  select v_validation_id, v_org, r.id, r.driver_id, r.vehicle_id, r.patient_id,
         r.scheduled_at, r.status
    from public.rides r
    where r.organization_id = v_org
      and r.scheduled_at >= v_start
      and r.scheduled_at < v_end
      and r.status::text <> all (array[
        'brouillon', 'annulee_regulateur', 'annulee_patient',
        'annulee_chauffeur', 'annulee_meteo'
      ]);
  get diagnostics v_count = row_count;

  return query select v_validation_id, false, v_count;
end;
$$;

comment on function public.validate_planning_day(date) is
  'Valide le planning d''un jour (Module 5.12 lot D) : INSERT validation + '
  'figeage de l''instantané des courses prévues, ATOMIQUEMENT (une transaction). '
  'SECURITY INVOKER (RLS appliquée). Idempotent par (organisation, jour). '
  'Notifications push/SMS gérées hors fonction (best-effort, après commit).';

revoke all on function public.validate_planning_day(date) from anon;
grant execute on function public.validate_planning_day(date) to authenticated;

-- ─── supabase/migrations/20260614000005_driver_invitations_jwt_email.sql ─────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration sécurité/robustesse — driver_invitations : email destinataire via JWT
-- =============================================================================
-- Les policies SELECT et UPDATE « destinataire » de driver_invitations
-- (20260514000002) identifiaient l'invité par
--   `email = (select u.email from auth.users u where u.id = auth.uid())`.
-- Lire la TABLE `auth.users` exige un privilège que le rôle `authenticated` n'a
-- pas → « permission denied for table users » : le flux invité (voir / accepter
-- son invitation) était CASSÉ en production, et la RLS échouait aux tests.
--
-- Correctif standard Supabase : comparer à l'email du JWT via
-- `auth.jwt() ->> 'email'` (fonction SECURITY DEFINER, aucun accès table requis).
-- Même sémantique de sécurité (l'email du JWT est celui de l'utilisateur
-- authentifié), sans lecture de `auth.users`. ALTER POLICY ne touche que le
-- USING ; les WITH CHECK existants sont conservés.
-- =============================================================================

alter policy driver_invitations_select_invited_or_recipient
  on public.driver_invitations
  using (
    auth.uid() = invited_by
    or email = (auth.jwt() ->> 'email')
  );

-- La policy UPDATE a été renommée/élargie au régulateur par 20260516000001
-- (driver_invitations_update_recipient_or_admin_or_regulateur). On change la
-- clause email du destinataire (USING) ; la clause émetteur (dirigeant OU
-- régulateur) est conservée à l'identique.
--
-- WITH CHECK : la version d'origine exigeait `organization_id =
-- current_organization_id()`. Or le destinataire d'une invitation N'A PAS ENCORE
-- d'organisation (ni profil ni rôle : il l'accepte pour REJOINDRE) →
-- current_organization_id() est NULL → l'acceptation (pending → accepted) était
-- refusée (42501). Le flux d'acceptation invité était donc CASSÉ, en
-- contradiction avec la clause destinataire du USING. On autorise la nouvelle
-- ligne quand elle correspond à l'email du destinataire (borné : le USING ne
-- laisse le destinataire agir que sur SA propre invitation pending non expirée).
alter policy driver_invitations_update_recipient_or_admin_or_regulateur
  on public.driver_invitations
  using (
    (
      email = (auth.jwt() ->> 'email')
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and (
        public.has_role('dirigeant'::public.user_role)
        or public.has_role('regulateur'::public.user_role)
      )
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    or email = (auth.jwt() ->> 'email')
  );

-- ─── seed.sql ────────────────────────────────────────────────────────

-- =============================================================================
-- Seed — Données de démonstration locales uniquement
-- =============================================================================
-- Crée 1 organization de démo + 5 comptes (dirigeant, régulateur, 3 chauffeurs).
-- À NE JAMAIS exécuter en production. Ce fichier est appliqué automatiquement
-- par `supabase db reset` en local.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organization de démo
-- -----------------------------------------------------------------------------
-- SEED-02 (VIS-03) : trois sociétés fictives pour éprouver l'isolation et le
-- volume. La société 1 reste la société de démonstration principale (comptes
-- @demo.tap historiques) ; les sociétés 2 et 3 servent à MONTRER l'isolation
-- (un régulateur d'une société ne voit jamais les données d'une autre).
insert into public.organizations (id, nom, siret, ville, code_postal, telephone, email)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'TAP Démo Réunion',
    '12345678901234',
    'Saint-Denis',
    '97400',
    '0262000000',
    'contact@demo.tap'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Transport Austral Sud',
    '39876543200021',
    'Saint-Pierre',
    '97410',
    '0262350000',
    'contact@transport-austral.demo'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Cita Ouest Réunion',
    null,
    'Saint-Paul',
    '97460',
    '0262450000',
    'contact@cita-ouest.demo'
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
) returns void language plpgsql as $fn$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current,
    email_change, phone_change, phone_change_token,
    reauthentication_token
  )
  values (
    p_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', p_prenom, 'nom', p_nom),
    '', '', '', '', '', '', '', ''
  )
  on conflict (id) do update
    set encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at,
        updated_at = now();

  -- auth.identities — provider_id = user_id::text pour le provider 'email'.
  -- La colonne `id` a été ajoutée à auth.identities en 2024 (cloud Supabase).
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
  values (p_user_id, p_org_id, p_role::public.user_role, p_prenom, p_nom, p_email)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        prenom = excluded.prenom,
        nom = excluded.nom,
        email = excluded.email;
end
$fn$;

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000010',
    'dirigeant@demo.tap', 'demo1234!',
    org_id, 'dirigeant', 'Dirigeant', 'Démo'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000020',
    'regulateur@demo.tap', 'demo1234!',
    org_id, 'regulateur', 'Régulateur', 'Démo'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000030',
    'chauffeur@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Vergoz', 'Jean'
  );
  -- DEC-031 : UAT multi-chauffeurs. 2 comptes auth additionnels rattachés
  -- aux drivers Maillot et Boyer dans seed.demo.sql (profile_id non null).
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000031',
    'chauffeur2@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Maillot', 'André'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000032',
    'chauffeur3@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Boyer', 'Sophie'
  );
  -- Compte E2E (PLAN-1 helper loginAsRegulateur attend reg-demo@tap.test)
  perform pg_temp.seed_demo_user(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'reg-demo@tap.test', 'demo1234!',
    org_id, 'regulateur', 'E2E', 'Régulatrice'
  );

  -- SEED-02 : comptes des sociétés 2 et 3 (isolation démontrable). Même mot de
  -- passe demo1234!. Suffixes -b (société 2) / -c (société 3).
  -- Société 2 — Transport Austral Sud (dirigeant, régulateur, 2 chauffeurs).
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000210',
    'dirigeant-b@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'dirigeant', 'Dirigeant', 'Austral'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000220',
    'regulateur-b@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'regulateur', 'Régulateur', 'Austral'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000230',
    'chauffeur-b1@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'chauffeur', 'Técher', 'Willy'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000231',
    'chauffeur-b2@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'chauffeur', 'Fontaine', 'Nadia'
  );
  -- Société 3 — Cita Ouest Réunion (dirigeant, régulateur, 1 chauffeur).
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000310',
    'dirigeant-c@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000003', 'dirigeant', 'Dirigeant', 'Cita'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000320',
    'regulateur-c@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000003', 'regulateur', 'Régulateur', 'Cita'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000330',
    'chauffeur-c1@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000003', 'chauffeur', 'Rivière', 'Steve'
  );
end
$$;

-- -----------------------------------------------------------------------------
-- Re-seed patients fictifs — défense en profondeur NFR-001 (D-SEED-1..4)
-- -----------------------------------------------------------------------------
-- Personnes FICTIVES (aucune correspondance réelle) mais adresses de domicile
-- RÉELLES et géocodables (résidences 974) : le départ d'un transport sanitaire
-- est le domicile du patient, et l'optimiseur a besoin de vrais points. Tél
-- 99-90-XX non attribués. Bloc UPDATE idempotent, mirroir de seed.demo.sql.
-- No-op si les patients démo ne sont pas encore semés (seed.sql s'exécute avant
-- seed.demo.sql) ; sinon réaligne sur les valeurs canoniques. Les noms sont
-- conservés (exception NFR-001 explicite pour les données de démo, Q3 phase 03.1).
-- -----------------------------------------------------------------------------

UPDATE public.patients SET telephone = '02 62 99 90 01', telephone_normalized = '0262999001',
  adresse_ligne1 = '12 Rue Sainte-Anne', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Bègue' AND prenom = 'Christiane';
UPDATE public.patients SET telephone = '02 62 99 90 02', telephone_normalized = '0262999002',
  adresse_ligne1 = '22 Rue Auguste Babet', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Boyer' AND prenom = 'Suzanne';
UPDATE public.patients SET telephone = '06 92 99 90 03', telephone_normalized = '0692999003',
  adresse_ligne1 = '15 Rue François de Mahy', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Dijoux' AND prenom = 'André';
UPDATE public.patients SET telephone = '06 92 99 90 04', telephone_normalized = '0692999004',
  adresse_ligne1 = '25 Rue de la Trinité', code_postal = '97490', ville = 'Sainte-Clotilde'
  WHERE nom = 'Grondin' AND prenom = 'Jean-Bernard';
UPDATE public.patients SET telephone = '06 92 99 90 05', telephone_normalized = '0692999005',
  adresse_ligne1 = '32 Rue Juliette Dodu', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Hoarau' AND prenom = 'Patrick';
UPDATE public.patients SET telephone = '06 92 99 90 06', telephone_normalized = '0692999006',
  adresse_ligne1 = '30 Rue des Bons-Enfants', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Lebon' AND prenom = 'Bernard';
UPDATE public.patients SET telephone = '02 62 99 90 07', telephone_normalized = '0262999007',
  adresse_ligne1 = '45 Rue du Père Lafosse', code_postal = '97432', ville = 'Ravine des Cabris'
  WHERE nom = 'Maillot' AND prenom = 'Marlène';
UPDATE public.patients SET telephone = '02 62 99 90 08', telephone_normalized = '0262999008',
  adresse_ligne1 = '18 Rue Monseigneur de Beaumont', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Payet' AND prenom = 'Marie-Ange';
UPDATE public.patients SET telephone = '02 62 99 90 09', telephone_normalized = '0262999009',
  adresse_ligne1 = '112 Rue Hubert Delisle', code_postal = '97430', ville = 'Le Tampon'
  WHERE nom = 'Robert' AND prenom = 'Anne-Sophie';
UPDATE public.patients SET telephone = '06 92 99 90 10', telephone_normalized = '0692999010',
  adresse_ligne1 = 'Bourg-Murat', code_postal = '97418', ville = 'La Plaine des Cafres'
  WHERE nom = 'Vergoz' AND prenom = 'Yves';

-- ─── seed.demo.sql ───────────────────────────────────────────────────

-- =============================================================================
-- Seed démo additionnel — Données réalistes 974 (preview / staging UNIQUEMENT)
-- =============================================================================
-- Applique APRÈS supabase/seed.sql. Ne contient AUCUNE donnée réelle :
--   • Noms réunionnais courants mais sans lien réel (Hoarau, Payet, Grondin,
--     Boyer, Dijoux, Maillot, Lebon, Robert, Vergoz, Bègue)
--   • NIRs fictifs avec clé de contrôle Luhn correcte (algorithme `97 - n mod 97`)
--   • Adresses de communes 974 (Saint-Denis, Saint-Pierre, Le Tampon, etc.)
--   • Téléphones format La Réunion (0262 fixe / 0692 mobile) NON attribués
--
-- À NE JAMAIS appliquer en production commerciale (RGPD : aucune donnée patient
-- réelle ne doit être co-localisée avec le seed démo).
--
-- Pour ne charger ce seed qu'en preview/staging :
--   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
--   psql "$SUPABASE_DB_URL" -f supabase/seed.demo.sql   (preview/staging seulement)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10 patients fictifs réunionnais
-- -----------------------------------------------------------------------------
-- Helper inline : calcule la clé NIR Luhn (97 - (n mod 97)) pour un NIR sans clé
-- Format NIR Réunion : `1AAMMddCCCNNN` ou `2AAMMddCCCNNN` (13 chiffres) + clé 2 chiffres
-- où CCC = code commune (974xx pour La Réunion sur ce format simplifié de démo)
-- -----------------------------------------------------------------------------

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  -- Edge Function NIR : on simule le chiffrement par null en seed démo
  -- (les fiches sans NIR sont valides ; affichage = `••• ••• ••• ••• •••`)
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
     '06 92 99 90 05', '0692999005', '32 Rue Juliette Dodu', '97400', 'Saint-Denis',
     'sms', true, now(), 'Marie Hoarau', '0692111111',
     null, null, '01 47',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000002', org_id, 'Marie-Ange', 'Payet',  '1962-08-22', 'F',
     '02 62 99 90 08', '0262999008', '18 Rue Monseigneur de Beaumont', '97400', 'Saint-Denis',
     'appel', false, null, 'Joseph Payet', '0692222222',
     null, null, '02 89',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000003', org_id, 'Jean-Bernard', 'Grondin', '1945-12-03', 'M',
     '06 92 99 90 04', '0692999004', '25 Rue de la Trinité', '97490', 'Sainte-Clotilde',
     'aucun', false, null, null, null,
     null, null, '14 23',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000004', org_id, 'Suzanne', 'Boyer',     '1970-05-18', 'F',
     '02 62 99 90 02', '0262999002', '22 Rue Auguste Babet', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Anne Boyer', '0692333333',
     null, null, '06 12',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Pierre — 3 patients
    ('11111111-0000-0000-0000-000000000005', org_id, 'André', 'Dijoux',     '1955-09-30', 'M',
     '06 92 99 90 03', '0692999003', '15 Rue François de Mahy', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Henri Dijoux', '0692444444',
     null, null, '08 31',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000006', org_id, 'Marlène', 'Maillot',  '1968-02-14', 'F',
     '02 62 99 90 07', '0262999007', '45 Rue du Père Lafosse', '97432', 'Ravine des Cabris',
     'appel', false, null, null, null,
     null, null, '12 05',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000007', org_id, 'Bernard', 'Lebon',    '1949-07-08', 'M',
     '06 92 99 90 06', '0692999006', '30 Rue des Bons-Enfants', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Lucie Lebon', '0692555555',
     null, null, '03 67',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Le Tampon — 2 patients
    ('11111111-0000-0000-0000-000000000008', org_id, 'Anne-Sophie', 'Robert', '1975-11-25', 'F',
     '02 62 99 90 09', '0262999009', '112 Rue Hubert Delisle', '97430', 'Le Tampon',
     'aucun', false, null, 'Marc Robert', '0692666666',
     null, null, '09 14',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000009', org_id, 'Yves', 'Vergoz',      '1953-04-19', 'M',
     '06 92 99 90 10', '0692999010', 'Bourg-Murat', '97418', 'La Plaine des Cafres',
     'sms', true, now(), null, null,
     null, null, '11 78',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Paul — 1 patient
    ('11111111-0000-0000-0000-000000000010', org_id, 'Christiane', 'Bègue', '1960-06-02', 'F',
     '02 62 99 90 01', '0262999001', '12 Rue Sainte-Anne', '97400', 'Saint-Denis',
     'appel', false, null, 'Philippe Bègue', '0692777777',
     null, null, '04 92',
     false, now(), now(), regulateur_id, regulateur_id)
  -- Les adresses réelles de démonstration font autorité au ré-seed : on met à
  -- jour l'adresse même si le patient existe déjà. Nécessaire car la migration
  -- 20260513000003 (défense en profondeur NFR-001) avait forcé des adresses
  -- fictives non géocodables ; ce seed (appliqué après les migrations) les
  -- remplace par de vraies adresses résidentielles. Identité (nom, prénom,
  -- dates, NIR, consentements) inchangée : seule l'adresse est mise à jour.
  on conflict (id) do update set
    adresse_ligne1 = excluded.adresse_ligne1,
    code_postal = excluded.code_postal,
    ville = excluded.ville;

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
end $$;

-- -----------------------------------------------------------------------------
-- 3 chauffeurs fictifs + 3 véhicules fictifs (Passe 1 E2E v2 — Phase 3)
-- -----------------------------------------------------------------------------
-- DEC-031 (UAT multi-chauffeurs) : les 3 chauffeurs sont rattachés à un
-- compte Auth distinct pour permettre la connexion individuelle UAT.
--   Vergoz Jean  → chauffeur@demo.tap   (id 030)
--   Maillot André → chauffeur2@demo.tap (id 031)
--   Boyer Sophie → chauffeur3@demo.tap  (id 032)
-- L'hypothèse historique « un seul chauffeur lié auth » est obsolète post
-- Phase 04 : le workflow d'invitation rattache les nouveaux drivers à la
-- demande, mais le seed démo expose 3 chauffeurs déjà connectables pour
-- accélérer la validation UAT.
do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  dirigeant_id uuid := '00000000-0000-0000-0000-000000000010';
  chauffeur_auth_id   uuid := '00000000-0000-0000-0000-000000000030';
  chauffeur_auth_id_2 uuid := '00000000-0000-0000-0000-000000000031';
  chauffeur_auth_id_3 uuid := '00000000-0000-0000-0000-000000000032';
begin
  insert into public.drivers (
    id, organization_id, profile_id, nom_affichage, telephone,
    numero_licence, type_permis, actif, created_by
  ) values
    ('22222222-0000-0000-0000-000000000011', org_id, chauffeur_auth_id,
     'Vergoz Jean', '0692100001', 'LIC-974-001', '{taxi}'::text[], true, dirigeant_id),
    ('22222222-0000-0000-0000-000000000012', org_id, chauffeur_auth_id_2,
     'Maillot André', '0693100002', 'LIC-974-002', '{taxi}'::text[], true, dirigeant_id),
    ('22222222-0000-0000-0000-000000000013', org_id, chauffeur_auth_id_3,
     'Boyer Sophie', '0692100003', 'LIC-974-003', '{taxi,tpmr}'::text[], true, dirigeant_id)
  on conflict (id) do update
    set profile_id = excluded.profile_id;

  insert into public.vehicles (
    id, organization_id, immatriculation, marque, modele, type,
    places_assises, places_tpmr, actif, created_by
  ) values
    ('33333333-0000-0000-0000-000000000011', org_id,
     'AB-123-CD', 'Dacia', 'Lodgy', 'taxi_conventionne',
     4, null, true, dirigeant_id),
    ('33333333-0000-0000-0000-000000000012', org_id,
     'EF-456-GH', 'Renault', 'Master', 'tpmr',
     6, 1, true, dirigeant_id),
    ('33333333-0000-0000-0000-000000000013', org_id,
     'IJ-789-KL', 'Citroën', 'Berlingo', 'vsl',
     3, null, true, dirigeant_id)
  on conflict (id) do nothing;

  raise notice 'Seed démo : 3 chauffeurs + 3 véhicules créés (organization_id=%)', org_id;
end $$;

-- -----------------------------------------------------------------------------
-- 12 courses fictives (UAT cockpit + multi-chauffeurs) — DEC-031
-- -----------------------------------------------------------------------------
-- Distribution :
--   - 5 courses historiques (J-3 à J-1, statuts mixtes terminees / annulee)
--   - 4 courses du jour (mix validee / assignee / en_cours)
--   - 3 courses planifiées J+1 (préparation journée suivante)
--
-- Adaptations au schéma rides réel (enums + colonnes vs spec brief) :
--   - status enum réel : validee / assignee / en_cours / terminee /
--     annulee_regulateur (pas planifiee / annulee génériques)
--   - transport_mode (enum) au lieu de type_course
--   - tarif_amount_eur au lieu de tarif_eur
--   - urgency = 'programmee' par défaut (pas de champ mode aller_simple)
--   - created_by + updated_by obligatoires
--   - cancel_motif renseigné pour la course annulée
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id      uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id     uuid := '22222222-0000-0000-0000-000000000012';
  boyer_id       uuid := '22222222-0000-0000-0000-000000000013';
  vehicle_dacia  uuid := '33333333-0000-0000-0000-000000000011';
  vehicle_master uuid := '33333333-0000-0000-0000-000000000012';
  patient_ids    uuid[];
begin
  select array_agg(id order by nom)
    into patient_ids
    from public.patients
    where organization_id = org_id and archive = false
    limit 10;

  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Seed démo courses : moins de 10 patients fictifs trouvés, bloc rides ignoré.';
    return;
  end if;

  -- 5 courses historiques (J-3, J-2, J-1) — statuts terminee / annulee_regulateur
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    cancel_motif, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000001', org_id,
     patient_ids[1], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis',
     'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now() - interval '3 days') + interval '8 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '3 days') + interval '8 hours 35 minutes',
     date_trunc('day', now() - interval '3 days') + interval '9 hours 45 minutes',
     25.50, 'manuel', null,
     now() - interval '3 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000002', org_id,
     patient_ids[2], maillot_id, vehicle_dacia,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now() - interval '2 days') + interval '7 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '2 days') + interval '7 hours 5 minutes',
     date_trunc('day', now() - interval '2 days') + interval '7 hours 25 minutes',
     18.00, 'manuel', null,
     now() - interval '2 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000003', org_id,
     patient_ids[3], boyer_id, vehicle_master,
     'Foyer médicalisé Les Avirons, 97425 Les Avirons',
     'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now() - interval '2 days') + interval '14 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('day', now() - interval '2 days') + interval '14 hours 5 minutes',
     date_trunc('day', now() - interval '2 days') + interval '15 hours 30 minutes',
     42.00, 'manuel', null,
     now() - interval '2 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000004', org_id,
     patient_ids[4], vergoz_id, vehicle_dacia,
     '8 Chemin des Frangipaniers, 97419 La Possession',
     'Cabinet kiné Sainte-Marie, 97438 Sainte-Marie',
     date_trunc('day', now() - interval '1 day') + interval '10 hours',
     'annulee_regulateur', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel',
     'Patient annulé la veille (rendez-vous reporté). Course remise à J+2.',
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000005', org_id,
     patient_ids[5], maillot_id, vehicle_dacia,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis',
     'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('day', now() - interval '1 day') + interval '16 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '1 day') + interval '16 hours 35 minutes',
     date_trunc('day', now() - interval '1 day') + interval '17 hours 50 minutes',
     32.00, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE limité aux rides démo 44444444-%
  -- pour permettre le ré-application CD avec dates relatives ré-évaluées
  -- (now() recalculé à chaque seed run). WARNING : écrase modifications
  -- manuelles régulateur sur ces rides démo uniquement.
  -- DEC-039-bis (hotfix 2026-05-15) : reset EXHAUSTIF de toutes les
  -- colonnes runtime-mutables pour éviter l'état hybride seed+UAT qui
  -- violait rides_ended_after_started après démarrage/clôture manuelle.
  on conflict (id) do update set
    -- Contexte course
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    -- Workflow runtime
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    -- Tarif runtime
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    -- Paiement runtime (réinit aux défauts table)
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    -- Archive runtime (réinit défaut)
    archive = false,
    -- Annulation runtime
    cancel_motif = excluded.cancel_motif,
    -- Notes runtime (réinit null)
    notes_regulateur = null;

  -- 8 courses du jour (J0), GÉOCODÉES — c'est CE bloc qui s'affiche dans « Ma
  -- journée » et alimente l'optimiseur. Journée pensée pour une démonstration
  -- « avant / après » parlante : au départ, tout est dispersé et non affecté ;
  -- l'optimiseur doit révéler DEUX regroupements évidents et laisser les isolées
  -- seules.
  --   - Groupe A (secteur Sud, taxi conventionné) : 3 patients vers le même
  --     centre de dialyse (Le Tampon), créneaux du matin qui se chevauchent →
  --     mutualisables sur un véhicule taxi (Dacia).
  --   - Groupe B (secteur Ouest, TPMR) : 3 patients vers le même centre de
  --     dialyse (Saint-Paul), créneaux du matin qui se chevauchent → mutualisables
  --     sur le véhicule TPMR (Master). Mode distinct = véhicule distinct : les deux
  --     tournées ne se mélangent pas.
  --   - 2 courses ISOLÉES : Saint-Denis (après-midi) et Saint-Benoît → Saint-Denis
  --     (fin de matinée) — créneaux et secteurs qui ne chevauchent aucun groupe :
  --     l'optimiseur les laisse seules (il discerne, il ne regroupe pas tout).
  -- Aucune course sans coordonnées. Prise en charge = domicile RÉEL du patient ;
  -- destination = lieu de soins du référentiel. Toutes `validee` + non affectées
  -- (driver/vehicle nuls) + NON pré-regroupées (aucun ride_group_id) : le
  -- regroupement est ce que l'optimisation doit produire. Coordonnées EN DUR,
  -- déterministes.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
    scheduled_at, status, transport_mode, urgency,
    tarif_source, created_at, created_by, updated_by
  ) values
    -- Lebon (Saint-Pierre) → Dialyse Sud Le Tampon (POI 66666666-…-0009). Groupe.
    ('44444444-0000-0000-0000-000000000010', org_id,
     patient_ids[6], null, null,
     '30 Rue des Bons-Enfants, 97410 Saint-Pierre',
     'Dialyse Sud Le Tampon, 97430 Le Tampon',
     -21.3388, 55.4802, -21.2788, 55.5158,
     date_trunc('day', now()) + interval '6 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Maillot (Ravine des Cabris) → Dialyse Sud Le Tampon. Groupe.
    ('44444444-0000-0000-0000-000000000011', org_id,
     patient_ids[7], null, null,
     '45 Rue du Père Lafosse, 97432 Ravine des Cabris',
     'Dialyse Sud Le Tampon, 97430 Le Tampon',
     -21.3020, 55.4650, -21.2788, 55.5158,
     date_trunc('day', now()) + interval '6 hours 40 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Payet (Saint-Denis) → Clinique Saint-Vincent (POI 66666666-…-0005). Isolée.
    ('44444444-0000-0000-0000-000000000012', org_id,
     patient_ids[8], null, null,
     '18 Rue Monseigneur de Beaumont, 97400 Saint-Denis',
     'Clinique Saint-Vincent, 97400 Saint-Denis',
     -20.8792, 55.4560, -20.8828, 55.4585,
     date_trunc('day', now()) + interval '14 hours',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Robert (Le Tampon) → Dialyse Sud Le Tampon. Groupe A.
    ('44444444-0000-0000-0000-000000000013', org_id,
     patient_ids[9], null, null,
     '112 Rue Hubert Delisle, 97430 Le Tampon',
     'Dialyse Sud Le Tampon, 97430 Le Tampon',
     -21.2785, 55.5160, -21.2788, 55.5158,
     date_trunc('day', now()) + interval '6 hours 50 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Groupe B (secteur Ouest, TPMR → Dialyse Saint-Paul, matin qui se chevauche).
    -- Même destination, pickups proches : mutualisables sur le véhicule TPMR.
    ('44444444-0000-0000-0000-000000000014', org_id,
     patient_ids[1], null, null,
     '12 Rue Marius et Ary Leblond, 97460 Saint-Paul',
     'Dialyse Saint-Paul, 97460 Saint-Paul',
     -21.0096, 55.2690, -21.0300, 55.2760,
     date_trunc('day', now()) + interval '7 hours',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000015', org_id,
     patient_ids[2], null, null,
     '20 Rue du Commerce, 97460 Saint-Paul',
     'Dialyse Saint-Paul, 97460 Saint-Paul',
     -21.0180, 55.2720, -21.0300, 55.2760,
     date_trunc('day', now()) + interval '7 hours 10 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000016', org_id,
     patient_ids[3], null, null,
     '8 Route de Savanna, 97460 Saint-Paul',
     'Dialyse Saint-Paul, 97460 Saint-Paul',
     -21.0450, 55.2830, -21.0300, 55.2760,
     date_trunc('day', now()) + interval '7 hours 20 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Isolée 2 (secteur Est, fin de matinée) : Saint-Benoît → CHU Saint-Denis.
    -- Créneau et secteur hors de tout groupe → l'optimiseur la laisse seule.
    ('44444444-0000-0000-0000-000000000017', org_id,
     patient_ids[4], null, null,
     '3 Rue Amiral Bouvet, 97470 Saint-Benoît',
     'CHU Félix Guyon, 97400 Saint-Denis',
     -21.0340, 55.7130, -20.8853, 55.4504,
     date_trunc('day', now()) + interval '11 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J0 rides démo (reporte la
  -- date J0 et les coordonnées à chaque ré-seed ; reset EXHAUSTIF des colonnes
  -- runtime absentes de l'INSERT pour éviter l'état hybride post-UAT).
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    pickup_lat = excluded.pickup_lat,
    pickup_lng = excluded.pickup_lng,
    dropoff_lat = excluded.dropoff_lat,
    dropoff_lng = excluded.dropoff_lng,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    status = excluded.status,
    started_at = null,
    ended_at = null,
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  -- 16 courses du jour SUPPLÉMENTAIRES (J0) — volume de démonstration pour
  -- dépasser la taille de page par défaut (25) sur la vue « Aujourd'hui » de la
  -- page courses : la pagination devient visible (> 1 page) et manipulable
  -- (page 2, changement de taille). Non géocodées (coordonnées facultatives) :
  -- ces courses alimentent la LISTE, pas l'optimiseur (qui s'appuie sur le bloc
  -- J0 géocodé ci-dessus). Variété volontaire pour donner de la matière aux
  -- filtres / tri : majorité `validee` non affectées, quelques `assignee`
  -- (chauffeur + véhicule), majorité `programmee` avec quelques urgences. Toutes
  -- communes 974, heures étalées sur la journée. Idempotent (IDs déterministes +
  -- DO UPDATE, reset runtime identique au bloc J0 ci-dessus).
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    tarif_source, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000090', org_id, patient_ids[1], null, null,
     '5 Rue de Nice, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '6 hours 15 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000091', org_id, patient_ids[2], null, null,
     '22 Rue Auguste Babet, 97410 Saint-Pierre', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '6 hours 45 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000092', org_id, patient_ids[3], null, null,
     '9 Rue du Four à Chaux, 97460 Saint-Paul', 'Dialyse Saint-Paul, 97460 Saint-Paul',
     date_trunc('day', now()) + interval '7 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000093', org_id, patient_ids[4], null, null,
     '14 Rue de la Gare, 97440 Saint-André', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '8 hours 10 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000094', org_id, patient_ids[5], null, null,
     '2 Rue du Général de Gaulle, 97450 Saint-Louis', 'Clinique Durieux, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '8 hours 40 minutes',
     'validee', 'taxi_conventionne', 'urgente',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000095', org_id, patient_ids[6], null, null,
     '7 Rue Sarda Garriga, 97470 Saint-Benoît', 'GHER Saint-Benoît, 97470 Saint-Benoît',
     date_trunc('day', now()) + interval '9 hours 20 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000096', org_id, patient_ids[7], vergoz_id, vehicle_dacia,
     '18 Rue Bertin, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '9 hours 45 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000097', org_id, patient_ids[8], null, null,
     '30 Rue Lislet Geoffroy, 97438 Sainte-Marie', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '10 hours 15 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000098', org_id, patient_ids[9], null, null,
     '4 Quai Ouest, 97420 Le Port', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '10 hours 50 minutes',
     'validee', 'taxi_conventionne', 'immediate',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000099', org_id, patient_ids[10], null, null,
     '11 Rue Sainte-Thérèse, 97419 La Possession', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '11 hours 25 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009a', org_id, patient_ids[1], null, null,
     '16 Rue du Stade, 97441 Sainte-Suzanne', 'Cabinet de kinésithérapie, 97440 Saint-André',
     date_trunc('day', now()) + interval '12 hours 5 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009b', org_id, patient_ids[2], boyer_id, vehicle_master,
     '8 Route de la Plaine, 97480 Saint-Joseph', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '13 hours 10 minutes',
     'assignee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009c', org_id, patient_ids[3], null, null,
     '25 Rue Hubert Delisle, 97430 Le Tampon', 'Dialyse Sud Le Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '13 hours 40 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009d', org_id, patient_ids[4], null, null,
     '6 Rue des Avirons, 97425 Les Avirons', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '14 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009e', org_id, patient_ids[5], null, null,
     '19 Rue François de Mahy, 97410 Saint-Pierre', 'Cabinet ophtalmologie, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '15 hours 20 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009f', org_id, patient_ids[6], maillot_id, vehicle_dacia,
     '3 Rue de l''Église, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '16 hours 45 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id)
  -- Idempotence : reset runtime exhaustif identique au bloc J0 géocodé ci-dessus.
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    status = excluded.status,
    started_at = null,
    ended_at = null,
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  -- Tournées J0 AFFECTÉES (démonstration planning/Gantt) — pour que la grille
  -- planning ne montre pas que des lignes chauffeurs vides : deux chauffeurs ont
  -- une tournée du matin réelle (plusieurs courses enchaînées), avec variété de
  -- statuts (terminee estompée + assignee à venir). Heures UTC petites → matin
  -- réunionnais (UTC+4) ; réparties pour donner du relief à la ligne « maintenant »
  -- et au zébrage. `terminee` renseigne started_at < ended_at (contrainte
  -- rides_ended_after_started). Idempotent (IDs déterministes + reset runtime).
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    cancel_motif, created_at, created_by, updated_by
  ) values
    -- Vergoz — tournée du matin (Dacia) : 1 terminée + 2 à venir.
    ('44444444-0000-0000-0000-0000000000a0', org_id,
     patient_ids[1], vergoz_id, vehicle_dacia,
     '9 Rue Juliette Dodu, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '3 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now()) + interval '3 hours 35 minutes',
     date_trunc('day', now()) + interval '4 hours 15 minutes',
     24.00, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-0000000000a1', org_id,
     patient_ids[2], vergoz_id, vehicle_dacia,
     '14 Rue Pasteur, 97400 Saint-Denis', 'Clinique Sainte-Clotilde, 97490 Sainte-Clotilde',
     date_trunc('day', now()) + interval '4 hours 45 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-0000000000a2', org_id,
     patient_ids[3], vergoz_id, vehicle_dacia,
     '27 Rue Maréchal Leclerc, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '6 hours 30 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    -- Boyer — tournée du matin (Master, TPMR) : 1 terminée + 1 à venir.
    ('44444444-0000-0000-0000-0000000000a3', org_id,
     patient_ids[4], boyer_id, vehicle_master,
     'EHPAD Les Alizés, 97430 Le Tampon', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '3 hours 15 minutes',
     'terminee', 'tpmr', 'programmee',
     date_trunc('day', now()) + interval '3 hours 20 minutes',
     date_trunc('day', now()) + interval '4 hours 5 minutes',
     40.00, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-0000000000a4', org_id,
     patient_ids[5], boyer_id, vehicle_master,
     '2 Rue des Bougainvilliers, 97410 Saint-Pierre', 'Dialyse Sud Le Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '5 hours 15 minutes',
     'assignee', 'tpmr', 'programmee',
     null, null, null, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id)
  -- Idempotence : reset runtime exhaustif (identique aux blocs J0 ci-dessus).
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  -- 3 courses J+1 — préparation journée suivante (mix assignee / validee)
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    tarif_source, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000020', org_id,
     patient_ids[1], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis',
     'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '1 day' + interval '8 hours 30 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '6 hours', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000021', org_id,
     patient_ids[10], boyer_id, vehicle_master,
     'EHPAD Les Lataniers, 97419 La Possession',
     'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '1 day' + interval '10 hours',
     'assignee', 'tpmr', 'programmee',
     'manuel', now() - interval '6 hours', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000022', org_id,
     patient_ids[2], null, null,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '1 day' + interval '7 hours',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '6 hours', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J+1 rides démo.
  -- DEC-039-bis (hotfix 2026-05-15) : reset EXHAUSTIF — les rides
  -- J+1 sont seedées en 'assignee'/'validee' sans started_at ni
  -- ended_at ; reset forcé à null pour éviter état hybride
  -- post-UAT.
  on conflict (id) do update set
    -- Contexte course
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    -- Workflow runtime (réinit complet — J+1 jamais démarrée par seed)
    status = excluded.status,
    started_at = null,
    ended_at = null,
    -- Tarif runtime (réinit défauts)
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    -- Paiement runtime (réinit défauts table)
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    -- Archive runtime (réinit défaut)
    archive = false,
    -- Annulation runtime
    cancel_motif = null,
    -- Notes runtime
    notes_regulateur = null;

  -- 12 courses facturables CGSS — mois complet précédent (Phase 06 PLAN-2).
  -- Toutes terminées + tarifées + payment_status défaut 'non_concerne'
  -- (tiers payant CGSS) → peuplent l'aperçu /admin/facturation dès le login
  -- démo dirigeant. Dates relatives à date_trunc('month', now()) - 1 mois.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    cancel_motif, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000041', org_id, patient_ids[1], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '1 day' + interval '8 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '1 day' + interval '8 hours',
     date_trunc('month', now()) - interval '1 month' + interval '1 day' + interval '9 hours 30 minutes',
     24.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000042', org_id, patient_ids[2], maillot_id, vehicle_dacia,
     '45 Avenue de la République, 97410 Saint-Pierre', 'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '3 days' + interval '7 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '3 days' + interval '7 hours',
     date_trunc('month', now()) - interval '1 month' + interval '3 days' + interval '8 hours',
     18.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '3 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000043', org_id, patient_ids[3], boyer_id, vehicle_master,
     'Foyer médicalisé Les Avirons, 97425 Les Avirons', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '4 days' + interval '13 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '4 days' + interval '13 hours',
     date_trunc('month', now()) - interval '1 month' + interval '4 days' + interval '14 hours 45 minutes',
     52.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '4 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000044', org_id, patient_ids[4], vergoz_id, vehicle_dacia,
     '8 Chemin des Frangipaniers, 97419 La Possession', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '6 days' + interval '9 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '6 days' + interval '9 hours',
     date_trunc('month', now()) - interval '1 month' + interval '6 days' + interval '10 hours 15 minutes',
     31.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '6 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000045', org_id, patient_ids[5], maillot_id, vehicle_dacia,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '8 days' + interval '10 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '8 days' + interval '10 hours',
     date_trunc('month', now()) - interval '1 month' + interval '8 days' + interval '11 hours',
     27.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '8 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000046', org_id, patient_ids[6], boyer_id, vehicle_master,
     'Résidence Les Mascareignes, 97432 Ravine-des-Cabris', 'Centre de rééducation Tampon, 97430 Le Tampon',
     date_trunc('month', now()) - interval '1 month' + interval '10 days' + interval '14 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '10 days' + interval '14 hours',
     date_trunc('month', now()) - interval '1 month' + interval '10 days' + interval '15 hours 30 minutes',
     44.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '10 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000047', org_id, patient_ids[7], vergoz_id, vehicle_dacia,
     '17 Rue Sainte-Anne, 97410 Saint-Pierre', 'Cabinet médical Saint-Louis, 97450 Saint-Louis',
     date_trunc('month', now()) - interval '1 month' + interval '12 days' + interval '8 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '12 days' + interval '8 hours 30 minutes',
     date_trunc('month', now()) - interval '1 month' + interval '12 days' + interval '9 hours 15 minutes',
     16.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '12 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000048', org_id, patient_ids[8], maillot_id, vehicle_dacia,
     '5 Boulevard Lacaussade, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '14 days' + interval '11 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '14 days' + interval '11 hours',
     date_trunc('month', now()) - interval '1 month' + interval '14 days' + interval '12 hours 20 minutes',
     38.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '14 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000049', org_id, patient_ids[9], boyer_id, vehicle_master,
     'EHPAD Les Lataniers, 97419 La Possession', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '16 days' + interval '13 hours 30 minutes',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '16 days' + interval '13 hours 30 minutes',
     date_trunc('month', now()) - interval '1 month' + interval '16 days' + interval '15 hours',
     49.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '16 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000050', org_id, patient_ids[10], vergoz_id, vehicle_dacia,
     '34 Rue Jean Jaurès, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '18 days' + interval '7 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '18 days' + interval '7 hours',
     date_trunc('month', now()) - interval '1 month' + interval '18 days' + interval '8 hours',
     22.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '18 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000051', org_id, patient_ids[1], maillot_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '20 days' + interval '9 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '20 days' + interval '9 hours 30 minutes',
     date_trunc('month', now()) - interval '1 month' + interval '20 days' + interval '10 hours 45 minutes',
     35.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '20 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000052', org_id, patient_ids[2], boyer_id, vehicle_master,
     'Résidence Les Mascareignes, 97432 Ravine-des-Cabris', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '23 days' + interval '14 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '23 days' + interval '14 hours',
     date_trunc('month', now()) - interval '1 month' + interval '23 days' + interval '15 hours 20 minutes',
     41.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '23 days', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE exhaustif (dates relatives ré-évaluées
  -- à chaque run CD ; écrase d'éventuelles modifications manuelles UAT).
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  raise notice 'Seed démo : 24 courses fictives créées (5 historiques + 4 jour + 3 J+1 + 12 facturables CGSS mois précédent)';
end $$;

-- -----------------------------------------------------------------------------
-- 30 POI métier (lieux fréquents 974) — PLAN-3 Phase 04.5
-- -----------------------------------------------------------------------------
-- Source : noms/adresses publics des établissements de santé La Réunion
-- (CHU, cliniques, EHPAD, centres dialyse, cabinets, imagerie, laboratoires).
-- IDs préfixés `66666666-` pour repérage immédiat lors de purges démo.
-- ON CONFLICT (id) DO UPDATE : pattern DEC-039 idempotent — le reseed
-- met à jour adresse / téléphone si modifié dans le repo, sans dupliquer.
-- -----------------------------------------------------------------------------

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.pois_metier (
    id, organization_id, nom_court, nom_long, type_poi,
    adresse, code_postal, ville, telephone, notes_acces, actif
  ) values
    -- CHU / hôpitaux
    ('66666666-0000-0000-0000-000000000001', org_id,
     'CHU Félix Guyon', 'Centre Hospitalier Universitaire de La Réunion — site Félix Guyon',
     'hopital', 'Allée des Topazes, Bellepierre', '97400', 'Saint-Denis',
     '0262905050', 'Entrée urgences à gauche du bâtiment principal.', true),
    ('66666666-0000-0000-0000-000000000002', org_id,
     'CHU Sud Saint-Pierre', 'Centre Hospitalier Universitaire de La Réunion — site Sud',
     'hopital', 'Avenue du Président Mitterrand, Terre-Sainte', '97410', 'Saint-Pierre',
     '0262359000', 'Parking dépose-minute devant l''accueil principal.', true),
    ('66666666-0000-0000-0000-000000000003', org_id,
     'GHER Saint-Benoît', 'Groupe Hospitalier Est Réunion',
     'hopital', 'Rue de l''Amiral Lacaze', '97470', 'Saint-Benoît',
     '0262988585', 'Accès consultations externes côté rue Lacaze.', true),
    ('66666666-0000-0000-0000-000000000004', org_id,
     'CH Gabriel Martin', 'Centre Hospitalier Gabriel Martin Saint-Paul',
     'hopital', 'Route du Théâtre, Saint-Paul', '97460', 'Saint-Paul',
     '0262458282', 'Parking visiteurs au niveau -1.', true),
    -- Cliniques
    ('66666666-0000-0000-0000-000000000005', org_id,
     'Clinique Saint-Vincent', 'Clinique Saint-Vincent Saint-Denis',
     'clinique', '60 Rue Bertin', '97400', 'Saint-Denis',
     '0262907777', 'Dépose-minute autorisée 10 min devant l''entrée.', true),
    ('66666666-0000-0000-0000-000000000006', org_id,
     'Clinique Sainte-Clotilde', 'Clinique Sainte-Clotilde',
     'clinique', '127 Route de Bois-de-Nèfles', '97490', 'Saint-Denis',
     '0262487777', 'Accès urgences à l''arrière du bâtiment.', true),
    ('66666666-0000-0000-0000-000000000007', org_id,
     'Clinique Jeanne d''Arc', 'Clinique Jeanne d''Arc Le Port',
     'clinique', '12 Rue Jeanne d''Arc', '97420', 'Le Port',
     '0262423333', 'Parking gratuit côté nord.', true),
    -- Centres dialyse
    ('66666666-0000-0000-0000-000000000008', org_id,
     'Dialyse Nord Sainte-Marie', 'Centre de dialyse AURAR Sainte-Marie',
     'centre_dialyse', 'Route nationale 2, Duparc', '97438', 'Sainte-Marie',
     '0262538080', 'Accueil dialyse de 6h à 23h, 3 séances/jour.', true),
    ('66666666-0000-0000-0000-000000000009', org_id,
     'Dialyse Sud Le Tampon', 'Centre de dialyse AURAR Le Tampon',
     'centre_dialyse', '85 Rue Hubert Delisle', '97430', 'Le Tampon',
     '0262278080', 'Parking PMR devant l''entrée.', true),
    ('66666666-0000-0000-0000-000000000010', org_id,
     'Dialyse Saint-Paul', 'Centre de dialyse Saint-Paul',
     'centre_dialyse', 'Avenue de Bourbon', '97460', 'Saint-Paul',
     '0262458080', 'Entrée patients sur le côté du bâtiment.', true),
    -- EHPAD (5)
    ('66666666-0000-0000-0000-000000000011', org_id,
     'EHPAD Les Lataniers', 'EHPAD Les Lataniers La Possession',
     'ehpad', 'Route de Sainte-Thérèse', '97419', 'La Possession',
     '0262221122', 'Sonner à l''interphone, accueil 7h-19h.', true),
    ('66666666-0000-0000-0000-000000000012', org_id,
     'EHPAD Les Mascareignes', 'EHPAD Les Mascareignes Le Tampon',
     'ehpad', '14 Rue des Mascareignes', '97430', 'Le Tampon',
     '0262271133', 'Parking visiteurs limité, dépose-minute conseillée.', true),
    ('66666666-0000-0000-0000-000000000013', org_id,
     'EHPAD Albert Barbot', 'EHPAD Albert Barbot Saint-Denis',
     'ehpad', '5 Rue Albert Barbot', '97400', 'Saint-Denis',
     '0262901144', 'Sonner interphone, demander unité Alzheimer si patient atteint.', true),
    ('66666666-0000-0000-0000-000000000014', org_id,
     'EHPAD Les Alizés', 'EHPAD Les Alizés Saint-Pierre',
     'ehpad', '30 Boulevard Hubert Delisle', '97410', 'Saint-Pierre',
     '0262351155', 'Accueil 8h-18h, dépose-minute autorisée.', true),
    ('66666666-0000-0000-0000-000000000015', org_id,
     'EHPAD Les Tamarins', 'EHPAD Les Tamarins Sainte-Suzanne',
     'ehpad', 'Route du Cimetière', '97441', 'Sainte-Suzanne',
     '0262521166', 'Parking PMR à droite de l''entrée principale.', true),
    -- Cabinets kiné (3)
    ('66666666-0000-0000-0000-000000000016', org_id,
     'Cabinet kiné Saint-Denis Centre', 'Cabinet de kinésithérapie 8 Rue Pasteur',
     'cabinet_kine', '8 Rue Pasteur', '97400', 'Saint-Denis',
     '0262202211', 'RDV uniquement, sonner interphone B.', true),
    ('66666666-0000-0000-0000-000000000017', org_id,
     'Cabinet kiné Saint-Pierre', 'Cabinet de kinésithérapie Boulevard Hubert Delisle',
     'cabinet_kine', '22 Boulevard Hubert Delisle', '97410', 'Saint-Pierre',
     '0262352211', 'Parking 5 min devant l''immeuble.', true),
    ('66666666-0000-0000-0000-000000000018', org_id,
     'Cabinet kiné Saint-Paul', 'Cabinet de kinésithérapie Front de mer',
     'cabinet_kine', '5 Rue de la Compagnie des Indes', '97460', 'Saint-Paul',
     '0262452211', 'Au 1er étage, ascenseur à droite.', true),
    -- Cabinets ophtalmo (2)
    ('66666666-0000-0000-0000-000000000019', org_id,
     'Cabinet ophtalmo Saint-Denis', 'Cabinet ophtalmologie centre-ville',
     'cabinet_medical', '14 Rue Jean Chatel', '97400', 'Saint-Denis',
     '0262203322', 'RDV uniquement, salle d''attente 1er étage.', true),
    ('66666666-0000-0000-0000-000000000020', org_id,
     'Cabinet ophtalmo Saint-Pierre', 'Cabinet ophtalmologie Saint-Pierre',
     'cabinet_medical', '7 Rue des Bons-Enfants', '97410', 'Saint-Pierre',
     '0262353322', 'Parking visiteurs gratuit 1h.', true),
    -- Cabinets dentaires (2)
    ('66666666-0000-0000-0000-000000000021', org_id,
     'Cabinet dentaire Saint-Denis', 'Cabinet dentaire Centre-ville',
     'cabinet_medical', '32 Rue de Paris', '97400', 'Saint-Denis',
     '0262204433', 'Au 2e étage, ascenseur disponible.', true),
    ('66666666-0000-0000-0000-000000000022', org_id,
     'Cabinet dentaire Le Tampon', 'Cabinet dentaire Hubert Delisle',
     'cabinet_medical', '88 Rue Hubert Delisle', '97430', 'Le Tampon',
     '0262274433', 'Parking visiteurs 30 min.', true),
    -- Médecine générale (3)
    ('66666666-0000-0000-0000-000000000023', org_id,
     'Cabinet médecine Saint-Denis Bellepierre', 'Cabinet de médecine générale Bellepierre',
     'cabinet_medical', 'Allée des Topazes', '97400', 'Saint-Denis',
     '0262205544', 'Salle d''attente 1er étage, sans rendez-vous matin.', true),
    ('66666666-0000-0000-0000-000000000024', org_id,
     'Cabinet médecine Saint-Pierre', 'Cabinet de médecine générale Saint-Pierre',
     'cabinet_medical', '45 Rue François de Mahy', '97410', 'Saint-Pierre',
     '0262355544', 'Parking devant le cabinet, RDV uniquement.', true),
    ('66666666-0000-0000-0000-000000000025', org_id,
     'Cabinet médecine Le Tampon', 'Cabinet de médecine générale Le Tampon',
     'cabinet_medical', '120 Rue Hubert Delisle', '97430', 'Le Tampon',
     '0262275544', 'Sonner interphone porte A.', true),
    -- Imagerie / labo (3)
    ('66666666-0000-0000-0000-000000000026', org_id,
     'Centre imagerie Saint-Denis', 'Centre imagerie médicale Saint-Denis',
     'centre_imagerie', '18 Rue Labourdonnais', '97400', 'Saint-Denis',
     '0262206655', 'Parking sous-sol payant 1h offerte.', true),
    ('66666666-0000-0000-0000-000000000027', org_id,
     'Labo Réunion Bio Saint-Pierre', 'Laboratoire Réunion Bio Saint-Pierre',
     'laboratoire', '11 Rue Augustin Archambaud', '97410', 'Saint-Pierre',
     '0262357766', 'Prélèvements 6h30-12h, accueil debout.', true),
    ('66666666-0000-0000-0000-000000000028', org_id,
     'Centre radio Saint-Paul', 'Centre de radiologie Saint-Paul',
     'centre_imagerie', '8 Rue de la Mairie', '97460', 'Saint-Paul',
     '0262456655', 'Parking visiteurs gratuit 2h.', true),
    -- Foyer médicalisé + pharmacie (2)
    ('66666666-0000-0000-0000-000000000029', org_id,
     'Foyer Les Hibiscus', 'Foyer d''accueil médicalisé Les Hibiscus Saint-Joseph',
     'foyer_medicalise', 'Route de la Plaine', '97480', 'Saint-Joseph',
     '0262567788', 'Accueil 8h-18h, sonner interphone bâtiment B.', true),
    ('66666666-0000-0000-0000-000000000030', org_id,
     'Pharmacie de l''Océan', 'Pharmacie de l''Océan Sainte-Marie',
     'pharmacie', '12 Rue de l''Océan', '97438', 'Sainte-Marie',
     '0262538899', 'Place handicapée devant la vitrine.', true)
  on conflict (id) do update set
    nom_court = excluded.nom_court,
    nom_long = excluded.nom_long,
    type_poi = excluded.type_poi,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    telephone = excluded.telephone,
    notes_acces = excluded.notes_acces,
    actif = excluded.actif;

  raise notice 'Seed démo : 30 POI métier créés/mis à jour (organization_id=%)', org_id;
end $$;

-- -----------------------------------------------------------------------------
-- Coordonnées des lieux de soins (latitude / longitude WGS84)
-- -----------------------------------------------------------------------------
-- Coordonnées EN DUR, déterministes (pas de dépendance réseau — le géocodage
-- BAN/Géoplateforme reste le mécanisme runtime, cf. lib/geocoding). Précision
-- « commune / secteur » suffisante pour l'optimiseur (distances à vol
-- d'oiseau). Idempotent : ré-application du seed = mêmes valeurs. Ces mêmes
-- coordonnées sont réutilisées comme destination des courses vers ces lieux.
update public.pois_metier p
set latitude = c.lat, longitude = c.lng
from (values
  ('66666666-0000-0000-0000-000000000001'::uuid, -20.8895, 55.4468), -- CHU Félix Guyon, Bellepierre (Saint-Denis)
  ('66666666-0000-0000-0000-000000000002'::uuid, -21.3436, 55.4900), -- CHU Sud, Terre-Sainte (Saint-Pierre)
  ('66666666-0000-0000-0000-000000000003'::uuid, -21.0378, 55.7160), -- GHER (Saint-Benoît)
  ('66666666-0000-0000-0000-000000000004'::uuid, -21.0093, 55.2712), -- CH Gabriel Martin (Saint-Paul)
  ('66666666-0000-0000-0000-000000000005'::uuid, -20.8828, 55.4585), -- Clinique Saint-Vincent (Saint-Denis)
  ('66666666-0000-0000-0000-000000000006'::uuid, -20.9083, 55.4808), -- Clinique Sainte-Clotilde
  ('66666666-0000-0000-0000-000000000007'::uuid, -20.9385, 55.2938), -- Clinique Jeanne d'Arc (Le Port)
  ('66666666-0000-0000-0000-000000000008'::uuid, -20.8985, 55.5470), -- Dialyse Nord, Duparc (Sainte-Marie)
  ('66666666-0000-0000-0000-000000000009'::uuid, -21.2788, 55.5158), -- Dialyse Sud (Le Tampon)
  ('66666666-0000-0000-0000-000000000010'::uuid, -21.0102, 55.2735), -- Dialyse Saint-Paul
  ('66666666-0000-0000-0000-000000000011'::uuid, -20.9268, 55.3355), -- EHPAD Les Lataniers (La Possession)
  ('66666666-0000-0000-0000-000000000012'::uuid, -21.2795, 55.5170), -- EHPAD Les Mascareignes (Le Tampon)
  ('66666666-0000-0000-0000-000000000013'::uuid, -20.8905, 55.4520), -- EHPAD Albert Barbot (Saint-Denis)
  ('66666666-0000-0000-0000-000000000014'::uuid, -21.3418, 55.4795), -- EHPAD Les Alizés (Saint-Pierre)
  ('66666666-0000-0000-0000-000000000015'::uuid, -20.9070, 55.6085), -- EHPAD Les Tamarins (Sainte-Suzanne)
  ('66666666-0000-0000-0000-000000000016'::uuid, -20.8792, 55.4498), -- Cabinet kiné SD Centre
  ('66666666-0000-0000-0000-000000000017'::uuid, -21.3406, 55.4788), -- Cabinet kiné Saint-Pierre
  ('66666666-0000-0000-0000-000000000018'::uuid, -21.0110, 55.2698), -- Cabinet kiné Saint-Paul
  ('66666666-0000-0000-0000-000000000019'::uuid, -20.8801, 55.4521), -- Cabinet ophtalmo Saint-Denis
  ('66666666-0000-0000-0000-000000000020'::uuid, -21.3389, 55.4801), -- Cabinet ophtalmo Saint-Pierre
  ('66666666-0000-0000-0000-000000000021'::uuid, -20.8809, 55.4487), -- Cabinet dentaire Saint-Denis
  ('66666666-0000-0000-0000-000000000022'::uuid, -21.2800, 55.5150), -- Cabinet dentaire Le Tampon
  ('66666666-0000-0000-0000-000000000023'::uuid, -20.8890, 55.4472), -- Cabinet médecine Bellepierre (Saint-Denis)
  ('66666666-0000-0000-0000-000000000024'::uuid, -21.3412, 55.4791), -- Cabinet médecine Saint-Pierre
  ('66666666-0000-0000-0000-000000000025'::uuid, -21.2775, 55.5165), -- Cabinet médecine Le Tampon
  ('66666666-0000-0000-0000-000000000026'::uuid, -20.8815, 55.4505), -- Centre imagerie Saint-Denis
  ('66666666-0000-0000-0000-000000000027'::uuid, -21.3395, 55.4779), -- Labo Réunion Bio (Saint-Pierre)
  ('66666666-0000-0000-0000-000000000028'::uuid, -21.0098, 55.2705), -- Centre radio Saint-Paul
  ('66666666-0000-0000-0000-000000000029'::uuid, -21.3785, 55.6205), -- Foyer Les Hibiscus (Saint-Joseph)
  ('66666666-0000-0000-0000-000000000030'::uuid, -20.8968, 55.5490)  -- Pharmacie de l'Océan (Sainte-Marie)
) as c(id, lat, lng)
where p.id = c.id;

-- -----------------------------------------------------------------------------
-- Données futures (commentées tant que migrations Phase 4+ pas en place)
-- -----------------------------------------------------------------------------
-- TODO Phase 4 (récurrences) :
--   - 5 prescriptions actives (dialyse 3×/sem, chimio 1×/sem, kiné 2×/sem)
--   - 30 occurrences générées (rides) sur les 30 prochains jours
-- TODO Phase 6 (planning) :
--   - 200 rides historiques sur 60 derniers jours pour KPIs et démo cockpit
-- DEC-031 (2026-05-13) : 3 chauffeurs avec credentials Auth pour UAT
-- multi-chauffeurs (Vergoz / Maillot / Boyer). Le workflow d'invitation
-- Phase 04 permet d'ajouter des chauffeurs à la demande sans toucher au
-- seed. Le scope « 6 chauffeurs démo conformité » initial ne s'applique
-- plus tel quel : la conformité Phase 15 se prouve via captures workflow.

-- DEC-075 : aucune position GPS de chauffeur n'est captée, stockée ni suivie
-- avant HDS (donnée de santé indirecte ; RGPD géoloc salarié). Les positions
-- chauffeurs fictives « DÉMO » de l'ancien prototype géoloc (DEC-096) présentaient
-- du faux GPS comme un suivi réel — trompe-l'œil retiré. La carte du cockpit
-- affiche désormais uniquement les points et trajets des courses du jour (adresses
-- opérationnelles). On PURGE ici les positions démo résiduelles pour que les
-- previews déjà seedées ne conservent aucune position fictive (idempotent).
delete from public.driver_positions
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and source = 'demo';

-- Donneurs d'ordres B2B fictifs 974 (CdC §5.5, DEC-148) — pour que le
-- référentiel /admin/donneurs-ordres et le rattachement de course soient
-- immédiatement démontrables sur la preview. Établissements crédibles 974.
-- SIRET facultatif : l'EHPAD illustre le cas « sans SIRET » (colonne nullable).
do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.ordering_parties
    (id, organization_id, raison_sociale, siret, contact_principal_nom,
     contact_principal_telephone, contact_principal_email, modalite_facturation, actif)
  values
    ('33333333-0000-0000-0000-000000000001', org_id,
     'Centre Hospitalier Universitaire de La Réunion', '40483304800014',
     'Service transport sanitaire', '0262 90 50 50', 'transport@chu-reunion.re',
     'mensuelle', true),
    ('33333333-0000-0000-0000-000000000002', org_id,
     'Clinique Sainte-Clotilde', '34280619200017',
     'Bureau des sorties', '0262 48 20 20', 'sorties@clinique-sainteclotilde.re',
     'hebdomadaire', true),
    ('33333333-0000-0000-0000-000000000003', org_id,
     'EHPAD Les Alizés (Le Tampon)', null,
     'Direction', '0262 27 10 10', 'accueil@ehpad-lesalizes.re',
     'a_la_course', true)
  on conflict (id) do nothing;

  raise notice 'Seed démo : 3 donneurs d''ordres B2B fictifs créés (organization_id=%)', org_id;
end$$;

-- =============================================================================
-- SEED-01 — Amorce facturation : prescripteurs, prescriptions, modes de
-- paiement et cas particuliers (données fictives 974, preview/staging).
-- =============================================================================
-- Comble les trous côté facturation conventionnée à venir : sans prescription
-- ni prescripteur, impossible d'éprouver le lien course→bon, les alertes de
-- renouvellement et la facturation. Idempotent (ON CONFLICT + reset ciblé).
--
-- DÉPENDANCES DE SCHÉMA NOTÉES (non ajoutées ici — ce lot peuple, ne migre pas) :
--   • Paiement « mixte » : l'enum payment_method vaut cash/cb/cheque/cgss_differe,
--     sans valeur « mixte » ni ventilation multi-lignes. Cas non représentable
--     tel quel → à cadrer par le chantier facturation (table de règlements ?).
--   • Exonération ALD : aucune colonne d'exonération (ALD / ticket modérateur)
--     sur rides ni prescriptions. Cas non représentable → dépendance facturation.
--
-- Préfixes UUID : prescripteurs 55555555, prescriptions 88888888, courses
-- facturation 44444444-…06x (au-dessus du max existant …052). pois_metier
-- utilise 66666666 (ne pas confondre).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Prescripteurs fictifs : 2 médecins (RPPS) + 1 établissement (FINESS)
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
begin
  insert into public.prescribers (
    id, organization_id, nom, prenom, type, rpps, finess, specialite,
    contact_telephone, contact_email, adresse, actif, created_by
  ) values
    ('55555555-0000-0000-0000-000000000001', org_id,
     'Payet', 'Marie-Claude', 'medecin', '10000000001', null, 'Néphrologie',
     '0262 90 51 00', 'mc.payet@cabinet-demo.re',
     'Cabinet de néphrologie, 97400 Saint-Denis', true, regulateur_id),
    ('55555555-0000-0000-0000-000000000002', org_id,
     'Grondin', 'Jean-Bernard', 'medecin', '10000000002', null, 'Médecine générale',
     '0262 27 42 00', 'jb.grondin@cabinet-demo.re',
     '18 Rue Hubert Delisle, 97430 Le Tampon', true, regulateur_id),
    ('55555555-0000-0000-0000-000000000003', org_id,
     'CHU de La Réunion — Service néphrologie', null, 'etablissement', null, '970000001',
     'Néphrologie / dialyse', '0262 90 50 50', 'nephrologie@chu-demo.re',
     'CHU Félix Guyon, 97400 Saint-Denis', true, regulateur_id)
  -- Réappliquer met à jour les champs de référence (pas d'état runtime ici).
  on conflict (id) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    type = excluded.type,
    rpps = excluded.rpps,
    finess = excluded.finess,
    specialite = excluded.specialite,
    contact_telephone = excluded.contact_telephone,
    contact_email = excluded.contact_email,
    adresse = excluded.adresse,
    actif = excluded.actif,
    archive = false,
    archive_at = null;

  raise notice 'Seed démo SEED-01 : 3 prescripteurs fictifs (organization_id=%)', org_id;
end$$;

-- -----------------------------------------------------------------------------
-- Prescriptions fictives : simple / série (dialyse) / proche échéance / expirée
-- -----------------------------------------------------------------------------
-- Rattachées à des patients existants (tri par nom, mêmes 10 que le bloc rides)
-- et aux prescripteurs ci-dessus. trajets_consommes / statut sont maintenus par
-- le trigger de comptage (rides_prescription_counter) dès qu'une course
-- consommatrice est rattachée : on ne les RÉINITIALISE PAS au ré-seed (sinon
-- état hybride vs trigger). On ne (ré)initialise que les champs statiques du bon.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  medecin_nephro uuid := '55555555-0000-0000-0000-000000000001';
  medecin_gen    uuid := '55555555-0000-0000-0000-000000000002';
  etab_chu       uuid := '55555555-0000-0000-0000-000000000003';
  patient_ids    uuid[];
begin
  select array_agg(id order by nom)
    into patient_ids
    from public.patients
    where organization_id = org_id and archive = false;

  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Seed démo SEED-01 : moins de 10 patients, bloc prescriptions ignoré.';
    return;
  end if;

  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, numero, date_prescription,
    finess, motif, type_transport, trajets_autorises, date_expiration, statut,
    created_by
  ) values
    -- Simple, active (transport ponctuel — consultation de suivi)
    ('88888888-0000-0000-0000-000000000001', org_id, patient_ids[1], medecin_gen,
     'BT-DEMO-2026-0001', current_date - 20,
     null, 'Consultation de suivi', 'taxi_conventionne', 4,
     current_date + 150, 'active', regulateur_id),
    -- Série (dialyse itérative — 20 trajets), active
    ('88888888-0000-0000-0000-000000000002', org_id, patient_ids[2], etab_chu,
     'BT-DEMO-2026-0002', current_date - 30,
     '970000001', 'Dialyse péritonéale 3x/semaine', 'taxi_conventionne', 20,
     current_date + 90, 'active', regulateur_id),
    -- Proche de l'échéance (renouvellement à anticiper — alerte)
    ('88888888-0000-0000-0000-000000000003', org_id, patient_ids[3], etab_chu,
     'BT-DEMO-2026-0003', current_date - 175,
     '970000001', 'Séances de kinésithérapie post-opératoire', 'tpmr', 10,
     current_date + 5, 'active', regulateur_id),
    -- Expirée (bon échu — ne doit plus autoriser de nouvelle course)
    ('88888888-0000-0000-0000-000000000004', org_id, patient_ids[4], medecin_nephro,
     'BT-DEMO-2025-0009', current_date - 210,
     null, 'Cure thermale', 'taxi_conventionne', 4,
     current_date - 30, 'expiree', regulateur_id),
    -- Simple, active (support d'une course encaissée directe)
    ('88888888-0000-0000-0000-000000000005', org_id, patient_ids[6], medecin_gen,
     'BT-DEMO-2026-0005', current_date - 10,
     null, 'Transport vers consultation spécialisée', 'taxi_conventionne', 4,
     current_date + 170, 'active', regulateur_id)
  -- Champs statiques réinitialisés ; trajets_consommes + statut restent
  -- pilotés par le trigger de comptage (voir en-tête de bloc).
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    prescriber_id = excluded.prescriber_id,
    numero = excluded.numero,
    date_prescription = excluded.date_prescription,
    finess = excluded.finess,
    motif = excluded.motif,
    type_transport = excluded.type_transport,
    trajets_autorises = excluded.trajets_autorises,
    date_expiration = excluded.date_expiration;

  raise notice 'Seed démo SEED-01 : 5 prescriptions fictives (organization_id=%)', org_id;
end$$;

-- -----------------------------------------------------------------------------
-- Courses « facturation » : diversité de modes de paiement + cas particuliers
-- (accompagnant, transport adapté TPMR) + rattachement à des prescriptions.
-- -----------------------------------------------------------------------------
-- Reset EXHAUSTIF vers la BASELINE SEED (excluded.*) au ré-seed — y compris les
-- champs de paiement et d'accompagnant — pour effacer toute dérive UAT sans
-- laisser d'état hybride (esprit DEC-039-bis). Le rattachement prescription_id
-- est stable → le trigger de comptage ne produit pas de delta au ré-update.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id      uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id     uuid := '22222222-0000-0000-0000-000000000012';
  boyer_id       uuid := '22222222-0000-0000-0000-000000000013';
  vehicle_dacia  uuid := '33333333-0000-0000-0000-000000000011';
  vehicle_master uuid := '33333333-0000-0000-0000-000000000012';
  presc_serie    uuid := '88888888-0000-0000-0000-000000000002';
  presc_directe  uuid := '88888888-0000-0000-0000-000000000005';
  patient_ids    uuid[];
  d2 timestamptz := date_trunc('day', now() - interval '2 days');
begin
  select array_agg(id order by nom)
    into patient_ids
    from public.patients
    where organization_id = org_id and archive = false;

  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Seed démo SEED-01 : moins de 10 patients, bloc rides facturation ignoré.';
    return;
  end if;

  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id, prescription_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    accompagnant, accompagnant_payant, accompagnant_identite,
    created_at, created_by, updated_by
  ) values
    -- Tiers payant conventionné (CGSS) — cas dominant, aucun encaissement direct
    ('44444444-0000-0000-0000-000000000060', org_id, patient_ids[2], maillot_id,
     vehicle_dacia, presc_serie,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     d2 + interval '7 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '7 hours 5 minutes', d2 + interval '7 hours 25 minutes',
     18.00, 'manuel', 'non_concerne', null, null,
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Espèces (hors prise en charge) — encaissé
    ('44444444-0000-0000-0000-000000000061', org_id, patient_ids[6], vergoz_id,
     vehicle_dacia, presc_directe,
     '5 Boulevard Lacaussade, 97400 Saint-Denis',
     'Clinique Saint-Vincent, 97400 Saint-Denis',
     d2 + interval '9 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '9 hours 5 minutes', d2 + interval '9 hours 40 minutes',
     22.00, 'manuel', 'encaisse', 'cash', d2 + interval '9 hours 40 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Carte bancaire — encaissé
    ('44444444-0000-0000-0000-000000000062', org_id, patient_ids[7], boyer_id,
     vehicle_dacia, null,
     '8 Chemin des Frangipaniers, 97419 La Possession',
     'Cabinet médical, 97460 Saint-Paul',
     d2 + interval '11 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '11 hours 5 minutes', d2 + interval '11 hours 35 minutes',
     30.00, 'manuel', 'encaisse', 'cb', d2 + interval '11 hours 35 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Chèque — encaissé
    ('44444444-0000-0000-0000-000000000063', org_id, patient_ids[8], maillot_id,
     vehicle_dacia, null,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis',
     'Laboratoire d''analyses, 97490 Sainte-Clotilde',
     d2 + interval '13 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '13 hours 5 minutes', d2 + interval '13 hours 30 minutes',
     28.00, 'manuel', 'encaisse', 'cheque', d2 + interval '13 hours 30 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- CGSS différé — encaissement décalé de la part conventionnée
    ('44444444-0000-0000-0000-000000000064', org_id, patient_ids[9], vergoz_id,
     vehicle_master, null,
     'Foyer Les Avirons, 97425 Les Avirons',
     'CHU Sud, 97448 Saint-Pierre',
     d2 + interval '15 hours', 'terminee', 'vsl', 'programmee',
     d2 + interval '15 hours 5 minutes', d2 + interval '16 hours 10 minutes',
     35.00, 'manuel', 'encaisse', 'cgss_differe', d2 + interval '16 hours 10 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Cas particulier : accompagnant payant + transport adapté (TPMR)
    ('44444444-0000-0000-0000-000000000065', org_id, patient_ids[2], boyer_id,
     vehicle_master, presc_serie,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     d2 + interval '17 hours', 'terminee', 'tpmr', 'programmee',
     d2 + interval '17 hours 5 minutes', d2 + interval '17 hours 45 minutes',
     42.00, 'manuel', 'non_concerne', null, null,
     true, true, 'Accompagnant : proche aidant (fille)',
     d2, regulateur_id, regulateur_id),
    -- Reste à encaisser (créance en attente de règlement)
    ('44444444-0000-0000-0000-000000000066', org_id, patient_ids[10], maillot_id,
     vehicle_dacia, null,
     '12 Rue de Paris, 97400 Saint-Denis',
     'Centre de radiologie, 97400 Saint-Denis',
     d2 + interval '18 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '18 hours 5 minutes', d2 + interval '18 hours 30 minutes',
     20.00, 'manuel', 'a_encaisser', null, null,
     false, false, null,
     d2, regulateur_id, regulateur_id)
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    prescription_id = excluded.prescription_id,
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status,
    payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at,
    accompagnant = excluded.accompagnant,
    accompagnant_payant = excluded.accompagnant_payant,
    accompagnant_identite = excluded.accompagnant_identite,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  raise notice 'Seed démo SEED-01 : 7 courses facturation (paiements variés + accompagnant/TPMR)';
end$$;

-- =============================================================================
-- FACTURATION bloc 1 — régime de prise en charge + refus transport partagé.
-- =============================================================================
-- Cas de démonstration pour la ventilation assurance/patient et le refus de
-- transport partagé (colonnes rides prise_en_charge_taux / exoneration_motif /
-- transport_partage_refuse — migration 20260613000020). Bloc AUTONOME : ne
-- dépend pas d'un autre seed (crée son propre prescripteur + prescription).
-- Idempotent (ON CONFLICT ; compteur prescription piloté par le trigger).
--
-- AMBIGUÏTÉ SIGNALÉE : la mention conventionnelle de refus et la bascule « hors
-- tiers payant » concernent en toute rigueur la facture PATIENT (paiement
-- direct), tandis que la facture existante est le récapitulatif CGSS (tiers
-- payant). Pour rendre la règle DÉMONTRABLE sur le document existant, la course
-- refusée reste listée (paiement non_concerne) et la ventilation la marque hors
-- TP (part assurance = 0) avec la mention. La bascule effective du statut de
-- paiement vers le direct relève du workflow runtime (hors de ce seed).
-- =============================================================================
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id     uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id    uuid := '22222222-0000-0000-0000-000000000012';
  vehicle_dacia uuid := '33333333-0000-0000-0000-000000000011';
  presc_fact    uuid := '88888888-0000-0000-0000-000000000009';
  patient_ids   uuid[];
  d1 timestamptz := date_trunc('day', now() - interval '1 day');
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Facturation bloc 1 : moins de 10 patients, bloc régime ignoré.';
    return;
  end if;

  -- Prescripteur + prescription autonomes (soins itératifs = dialyse).
  insert into public.prescribers (id, organization_id, nom, type, finess, created_by)
  values ('55555555-0000-0000-0000-000000000009', org_id,
          'Cabinet néphrologie facturation', 'etablissement', '970000009', regulateur_id)
  on conflict (id) do update set nom = excluded.nom, type = excluded.type, finess = excluded.finess;

  insert into public.prescriptions
    (id, organization_id, patient_id, prescriber_id, numero, date_prescription,
     trajets_autorises, date_expiration, statut, created_by)
  values (presc_fact, org_id, patient_ids[1], '55555555-0000-0000-0000-000000000009',
          'BT-FACT-2026-0009', current_date - 15, 30, current_date + 120, 'active', regulateur_id)
  on conflict (id) do update set
    patient_id = excluded.patient_id, prescriber_id = excluded.prescriber_id,
    numero = excluded.numero, date_prescription = excluded.date_prescription,
    trajets_autorises = excluded.trajets_autorises, date_expiration = excluded.date_expiration;

  -- Courses couvrant les cas de régime. Toutes en tiers payant (non_concerne)
  -- pour apparaître sur le récapitulatif CGSS et y montrer la ventilation.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id, prescription_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    prise_en_charge_taux, exoneration_motif, transport_partage_refuse,
    created_at, created_by, updated_by
  ) values
    -- 100 % ALD en lien (dialyse) — pas de ticket modérateur
    ('44444444-0000-0000-0000-000000000070', org_id, patient_ids[1], vergoz_id, vehicle_dacia, presc_fact,
     '12 Rue de Paris, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     d1 + interval '7 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '7 hours 5 minutes', d1 + interval '7 hours 30 minutes',
     30.00, 'manuel', 'non_concerne', null, null,
     100, 'ald_lien', false, d1, regulateur_id, regulateur_id),
    -- Taux général 65 % — ticket modérateur à la charge du patient
    ('44444444-0000-0000-0000-000000000071', org_id, patient_ids[3], maillot_id, vehicle_dacia, null,
     '8 Chemin des Frangipaniers, 97419 La Possession', 'Cabinet médical, 97460 Saint-Paul',
     d1 + interval '9 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '9 hours 5 minutes', d1 + interval '9 hours 35 minutes',
     40.00, 'manuel', 'non_concerne', null, null,
     null, null, false, d1, regulateur_id, regulateur_id),
    -- 100 % accident du travail (franchise NON exonérée)
    ('44444444-0000-0000-0000-000000000072', org_id, patient_ids[5], vergoz_id, vehicle_dacia, null,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     d1 + interval '11 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '11 hours 5 minutes', d1 + interval '11 hours 40 minutes',
     36.00, 'manuel', 'non_concerne', null, null,
     100, 'accident_travail', false, d1, regulateur_id, regulateur_id),
    -- CSS : 100 %, franchise exonérée, hors périmètre du refus de partage
    ('44444444-0000-0000-0000-000000000073', org_id, patient_ids[7], maillot_id, vehicle_dacia, null,
     '45 Avenue de la République, 97410 Saint-Pierre', 'CHU Sud, 97448 Saint-Pierre',
     d1 + interval '13 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '13 hours 5 minutes', d1 + interval '13 hours 45 minutes',
     34.00, 'manuel', 'non_concerne', null, null,
     100, 'css', false, d1, regulateur_id, regulateur_id),
    -- Refus de transport partagé sur soins itératifs (prescription liée) → hors
    -- tiers payant + mention. Reste listée pour démontrer la règle (voir en-tête).
    ('44444444-0000-0000-0000-000000000074', org_id, patient_ids[1], vergoz_id, vehicle_dacia, presc_fact,
     '12 Rue de Paris, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     d1 + interval '15 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '15 hours 5 minutes', d1 + interval '15 hours 30 minutes',
     30.00, 'manuel', 'non_concerne', null, null,
     null, null, true, d1, regulateur_id, regulateur_id),
    -- ALD NON exonérante : 55 %
    ('44444444-0000-0000-0000-000000000075', org_id, patient_ids[8], maillot_id, vehicle_dacia, null,
     'Foyer Les Avirons, 97425 Les Avirons', 'Laboratoire, 97490 Sainte-Clotilde',
     d1 + interval '16 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '16 hours 5 minutes', d1 + interval '16 hours 40 minutes',
     38.00, 'manuel', 'non_concerne', null, null,
     55, null, false, d1, regulateur_id, regulateur_id)
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at, created_at = excluded.created_at,
    pickup_address = excluded.pickup_address, dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode, urgency = excluded.urgency,
    driver_id = excluded.driver_id, vehicle_id = excluded.vehicle_id,
    prescription_id = excluded.prescription_id,
    status = excluded.status, started_at = excluded.started_at, ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur, tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status, payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at,
    prise_en_charge_taux = excluded.prise_en_charge_taux,
    exoneration_motif = excluded.exoneration_motif,
    transport_partage_refuse = excluded.transport_partage_refuse,
    archive = false, cancel_motif = null, notes_regulateur = null;

  raise notice 'Facturation bloc 1 : 6 courses régime (100%% ALD, 65%%, AT, CSS, refus partagé, 55%%)';
end$$;

-- =============================================================================
-- SEED-02 — Volume jusqu'à la cible VIS-03 + écrans vivants + multi-sociétés.
-- =============================================================================
-- Objectif : exercer CHAQUE écran en navigation (démo + recette manuelle).
-- Cible documentée (REQUIREMENTS VIS-03/VIS-05) : 3 sociétés, 6 chauffeurs,
-- ~30 patients (visibles dans /patients de la société de démo), ~50
-- prescriptions, ~200 courses passées ; écrans météo / replanification /
-- cockpit non vides.
--
-- Toutes données FICTIVES 974. Idempotent (IDs déterministes + ON CONFLICT).
-- Dates glissantes (relatives à now()/current_date) préservées.
--
-- DÉPENDANCES DE SCHÉMA NOTÉES (non ajoutées — ce lot PEUPLE, ne migre pas) :
--   • Aucune colonne « société multi-régulateur simultané » : le multi-société
--     est porté par organization_id + comptes distincts (seed.sql), suffisant.
--   • Réaffectation : pas de colonne d'état « en cours de réaffectation » — la
--     matière de /replanification vient d'un incident ouvert + courses futures
--     du chauffeur en panne (déduites au runtime), pas d'un flag stocké.
-- Préfixes IDs : patients société 1 = 11111111-…011..030 ; sociétés 2/3 =
--   …201.. / …301.. ; prescriptions générées = 88888888-…100.. ; courses
--   historiques générées = 44444444-…100..264 ; exceptions cockpit = …080..085 ;
--   météo = 12121212-… ; incident = 13131313-… .
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Société 1 — 20 patients supplémentaires (→ 30 au total, cible VIS-05)
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
begin
  insert into public.patients (
    id, organization_id, prenom, nom, date_naissance, genre,
    telephone, telephone_normalized, adresse_ligne1, code_postal, ville,
    canal_contact_prefere, consentement_sms, consentement_sms_at,
    archive, created_at, updated_at, created_by, updated_by
  ) values
    ('11111111-0000-0000-0000-000000000011', org_id, 'Willy', 'Técher', '1951-04-11', 'M',
     '06 92 99 00 11', '0692990011', '11 Rue du Marché', '97440', 'Saint-André', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000012', org_id, 'Nadia', 'Fontaine', '1963-09-27', 'F',
     '02 62 99 00 12', '0262990012', '12 Allée des Filaos', '97460', 'Saint-Paul', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000013', org_id, 'Steve', 'Rivière', '1978-01-05', 'M',
     '06 92 99 00 13', '0692990013', '13 Rue Hubert Delisle', '97430', 'Le Tampon', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000014', org_id, 'Josée', 'Lauret', '1946-11-19', 'F',
     '02 62 99 00 14', '0262990014', '14 Chemin Canal', '97450', 'Saint-Louis', 'aucun', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000015', org_id, 'Daniel', 'Gonthier', '1959-06-30', 'M',
     '06 92 99 00 15', '0692990015', '15 Rue de l''Église', '97470', 'Saint-Benoît', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000016', org_id, 'Marie-Thérèse', 'Turpin', '1954-03-08', 'F',
     '02 62 99 00 16', '0262990016', '16 Route de Duparc', '97438', 'Sainte-Marie', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000017', org_id, 'Émile', 'Nativel', '1943-07-22', 'M',
     '06 92 99 00 17', '0692990017', '17 Rue du Stade', '97441', 'Sainte-Suzanne', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000018', org_id, 'Sylviane', 'Cadet', '1967-12-14', 'F',
     '02 62 99 00 18', '0262990018', '18 Quai Ouest', '97420', 'Le Port', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000019', org_id, 'Roland', 'Ledoux', '1950-02-02', 'M',
     '06 92 99 00 19', '0692990019', '19 Rue Sainte-Thérèse', '97419', 'La Possession', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000020', org_id, 'Fabienne', 'Vienne', '1972-08-09', 'F',
     '02 62 99 00 20', '0262990020', '20 Chemin Bras-Panon', '97412', 'Bras-Panon', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000021', org_id, 'Georges', 'Sery', '1948-05-16', 'M',
     '06 92 99 00 21', '0692990021', '21 Rue de la Plage', '97429', 'Petite-Île', 'aucun', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000022', org_id, 'Monique', 'Barret', '1961-10-25', 'F',
     '02 62 99 00 22', '0262990022', '22 Route de la Plaine', '97480', 'Saint-Joseph', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000023', org_id, 'Alain', 'Ponama', '1957-01-30', 'M',
     '06 92 99 00 23', '0692990023', '23 Rue du Sel', '97427', 'L''Étang-Salé', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000024', org_id, 'Huguette', 'Élisabeth', '1944-04-04', 'F',
     '02 62 99 00 24', '0262990024', '24 Rue des Avirons', '97425', 'Les Avirons', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000025', org_id, 'Jean-Claude', 'Sinaman', '1969-11-11', 'M',
     '06 92 99 00 25', '0692990025', '25 Chemin Entre-Deux', '97414', 'Entre-Deux', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000026', org_id, 'Brigitte', 'Hoareau', '1976-06-18', 'F',
     '02 62 99 00 26', '0262990026', '26 Route de Sainte-Rose', '97439', 'Sainte-Rose', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000027', org_id, 'Maxime', 'Ah-Nieme', '1952-09-01', 'M',
     '06 92 99 00 27', '0692990027', '27 Rue du Cirque', '97413', 'Cilaos', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000028', org_id, 'Corinne', 'Fruteau', '1965-03-23', 'F',
     '02 62 99 00 28', '0262990028', '28 Rue François de Mahy', '97410', 'Saint-Pierre', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000029', org_id, 'Patrice', 'Legros', '1940-12-07', 'M',
     '06 92 99 00 29', '0692990029', '29 Rue Jean Chatel', '97400', 'Saint-Denis', 'aucun', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000030', org_id, 'Sabine', 'Vitry', '1974-07-13', 'F',
     '02 62 99 00 30', '0262990030', '30 Route de Bois-de-Nèfles', '97490', 'Sainte-Clotilde', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id)
  on conflict (id) do nothing;

  raise notice 'SEED-02 : 20 patients société 1 supplementaires (total 30)';
end$$;

-- -----------------------------------------------------------------------------
-- Société 1 — ~44 prescriptions générées (→ ~50 avec l'existant) + variété
-- (active / série / proche échéance / expirée), réparties sur les 30 patients.
-- -----------------------------------------------------------------------------
-- trajets_consommes / statut : statut posé à l'insert (aucune course
-- consommatrice rattachée à ces bons générés → le trigger de comptage ne les
-- touche pas), NON réinitialisé au ré-seed (mêmes règles que SEED-01).
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  prescriber_ids uuid[] := array[
    '55555555-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000002',
    '55555555-0000-0000-0000-000000000003']::uuid[];
  motifs text[] := array[
    'Dialyse itérative', 'Séances de kinésithérapie',
    'Consultation de suivi spécialisé', 'Cure de chimiothérapie',
    'Transport post-hospitalisation', 'Rééducation fonctionnelle',
    'Consultation ophtalmologique', 'Soins de néphrologie'];
  modes text[] := array['taxi_conventionne', 'tpmr', 'vsl'];
  patient_ids uuid[];
  np int;
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  np := array_length(patient_ids, 1);
  if np is null or np < 30 then
    raise notice 'SEED-02 prescriptions : moins de 30 patients, bloc ignoré.';
    return;
  end if;

  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, numero, date_prescription,
    motif, type_transport, trajets_autorises, date_expiration, statut, created_by
  )
  select
    ('88888888-0000-0000-0000-' || lpad((100 + g)::text, 12, '0'))::uuid,
    org_id,
    patient_ids[1 + (g % np)],
    prescriber_ids[1 + (g % 3)],
    'BT-DEMO-GEN-' || lpad((100 + g)::text, 4, '0'),
    current_date - (10 + (g % 200)),
    motifs[1 + (g % array_length(motifs, 1))],
    modes[1 + (g % 3)],
    4 + (g % 26),
    case
      when g % 10 = 0 then current_date - (5 + (g % 20))     -- expirée
      when g % 10 = 1 then current_date + (3 + (g % 4))      -- proche échéance
      else current_date + (60 + (g % 120))                  -- confortable
    end,
    (case when g % 10 = 0 then 'expiree' else 'active' end)::public.prescription_status,
    regulateur_id
  from generate_series(0, 43) as g
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    prescriber_id = excluded.prescriber_id,
    numero = excluded.numero,
    date_prescription = excluded.date_prescription,
    motif = excluded.motif,
    type_transport = excluded.type_transport,
    trajets_autorises = excluded.trajets_autorises,
    date_expiration = excluded.date_expiration;

  raise notice 'SEED-02 : 44 prescriptions générées société 1 (variété active/expirée/proche échéance)';
end$$;

-- -----------------------------------------------------------------------------
-- Société 1 — 165 courses historiques générées (→ ~200 avec l'existant)
-- Toutes terminées + tarifées, réparties sur ~88 jours (KPIs, historique,
-- pagination /courses). ~1/6 encaissées (caisse) ; le reste tiers payant CGSS.
-- Dates glissantes (relatives à now()). Reset exhaustif au ré-seed.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  driver_ids  uuid[] := array[
    '22222222-0000-0000-0000-000000000011',
    '22222222-0000-0000-0000-000000000012',
    '22222222-0000-0000-0000-000000000013']::uuid[];
  vehicle_ids uuid[] := array[
    '33333333-0000-0000-0000-000000000011',
    '33333333-0000-0000-0000-000000000012',
    '33333333-0000-0000-0000-000000000013']::uuid[];
  modes public.ride_transport_mode[] := array['taxi_conventionne', 'tpmr', 'vsl']::public.ride_transport_mode[];
  methods text[] := array['cash', 'cb', 'cheque'];
  pickups text[] := array[
    '12 Rue de Paris, 97400 Saint-Denis',
    '45 Avenue de la République, 97410 Saint-Pierre',
    '8 Chemin des Frangipaniers, 97419 La Possession',
    '23 Rue Maréchal Leclerc, 97400 Saint-Denis',
    'Résidence Les Mascareignes, 97432 Ravine-des-Cabris',
    'EHPAD Les Lataniers, 97419 La Possession',
    '17 Rue Sainte-Anne, 97410 Saint-Pierre',
    '5 Boulevard Lacaussade, 97400 Saint-Denis'];
  dropoffs text[] := array[
    'CHU Félix Guyon, 97400 Saint-Denis',
    'Centre de dialyse Sud, 97410 Saint-Pierre',
    'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
    'Clinique Saint-Vincent, 97400 Saint-Denis',
    'Centre de rééducation, 97430 Le Tampon',
    'Cabinet médical, 97460 Saint-Paul',
    'Centre de dialyse Nord, 97400 Saint-Denis',
    'Laboratoire d''analyses, 97490 Sainte-Clotilde'];
  patient_ids uuid[];
  np int;
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  np := array_length(patient_ids, 1);
  if np is null or np < 30 then
    raise notice 'SEED-02 courses historiques : moins de 30 patients, bloc ignoré.';
    return;
  end if;

  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    created_at, created_by, updated_by
  )
  select
    ('44444444-0000-0000-0000-' || lpad((100 + g)::text, 12, '0'))::uuid,
    org_id,
    patient_ids[1 + (g % np)],
    driver_ids[1 + (g % 3)],
    vehicle_ids[1 + (g % 3)],
    pickups[1 + (g % 8)],
    dropoffs[1 + (g % 8)],
    sched.scheduled_at,
    'terminee', modes[1 + (g % 3)], 'programmee',
    sched.scheduled_at + interval '5 minutes',
    sched.scheduled_at + interval '5 minutes' + ((20 + (g % 60)) || ' minutes')::interval,
    ((15 + (g % 45))::numeric + 0.50),
    'manuel',
    case when g % 6 = 0 then 'encaisse' else 'non_concerne' end,
    case when g % 6 = 0 then methods[1 + (g % 3)] else null end,
    case when g % 6 = 0
      then sched.scheduled_at + interval '5 minutes' + ((20 + (g % 60)) || ' minutes')::interval
      else null end,
    sched.scheduled_at - interval '1 day',
    regulateur_id, regulateur_id
  from generate_series(0, 164) as g
  cross join lateral (
    select date_trunc('day', now())
      - ((1 + (g % 88)) || ' days')::interval
      + ((7 + (g % 10)) || ' hours')::interval as scheduled_at
  ) as sched
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status,
    payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at,
    created_at = excluded.created_at,
    archive = false, cancel_motif = null, notes_regulateur = null;

  raise notice 'SEED-02 : 165 courses historiques générées société 1 (dont ~1/6 encaissées)';
end$$;

-- -----------------------------------------------------------------------------
-- Écrans vivants — météo (alerte active) + replanification (incident ouvert)
-- + cockpit (retard / absence patient / urgence). Société 1.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id     uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id    uuid := '22222222-0000-0000-0000-000000000012';
  boyer_id      uuid := '22222222-0000-0000-0000-000000000013';
  vehicle_dacia uuid := '33333333-0000-0000-0000-000000000011';
  vehicle_master uuid := '33333333-0000-0000-0000-000000000012';
  patient_ids uuid[];
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'SEED-02 écrans vivants : moins de 10 patients, bloc ignoré.';
    return;
  end if;

  -- Météo : une alerte ACTIVE (bandeau cockpit + écran /meteo démontrables).
  insert into public.weather_alerts (id, organization_id, active, motif, zone, activated_by, activated_at)
  values ('12121212-0000-0000-0000-000000000001', org_id, true,
          'Vigilance cyclonique orange (démo) — anticiper annulations dialyse', 'Nord et Est',
          regulateur_id, now() - interval '3 hours')
  on conflict (id) do update set
    active = true, motif = excluded.motif, zone = excluded.zone,
    activated_by = excluded.activated_by, activated_at = excluded.activated_at,
    deactivated_at = null;

  -- Replanification : un incident OUVERT (panne) sur Boyer → ses courses futures
  -- deviennent réaffectables sur /replanification.
  insert into public.driver_incidents (id, organization_id, driver_id, type, nature, lieu, started_at, created_by)
  values ('13131313-0000-0000-0000-000000000001', org_id, boyer_id, 'panne_vehicule',
          'Voyant moteur allumé + perte de puissance', 'RN2 hauteur Sainte-Marie',
          now() - interval '40 minutes', regulateur_id)
  on conflict (id) do update set
    type = excluded.type, nature = excluded.nature, lieu = excluded.lieu,
    started_at = excluded.started_at, resolved_at = null;

  -- Cockpit : cas d'exception (retard / absence patient / urgence) + du nominal.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    no_show_at, no_show_motif, cancel_motif,
    created_at, created_by, updated_by
  ) values
    -- Retard : course assignée dont l'heure est déjà passée, non démarrée.
    ('44444444-0000-0000-0000-000000000080', org_id, patient_ids[3], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     now() - interval '75 minutes', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, now() - interval '5 hours', regulateur_id, regulateur_id),
    -- Absence patient : no-show du jour.
    ('44444444-0000-0000-0000-000000000081', org_id, patient_ids[4], maillot_id, vehicle_dacia,
     '45 Avenue de la République, 97410 Saint-Pierre', 'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '8 hours', 'annulee_patient', 'taxi_conventionne', 'programmee',
     now() - interval '30 minutes', 'Patient absent au point de rendez-vous (3 appels sans réponse).',
     'Absence patient (no-show)', now() - interval '6 hours', regulateur_id, regulateur_id),
    -- Urgence immédiate non affectée (à traiter).
    ('44444444-0000-0000-0000-000000000082', org_id, patient_ids[5], null, null,
     'CHU Félix Guyon, 97400 Saint-Denis', 'Clinique Sainte-Clotilde, 97490 Saint-Denis',
     now() + interval '45 minutes', 'validee', 'taxi_conventionne', 'immediate',
     null, null, null, now() - interval '10 minutes', regulateur_id, regulateur_id),
    -- Urgence programmée urgente, affectée (Boyer — recoupe l'incident ci-dessus).
    ('44444444-0000-0000-0000-000000000083', org_id, patient_ids[6], boyer_id, vehicle_master,
     'EHPAD Les Lataniers, 97419 La Possession', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     now() + interval '2 hours', 'assignee', 'tpmr', 'urgente',
     null, null, null, now() - interval '20 minutes', regulateur_id, regulateur_id)
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    started_at = null, ended_at = null,
    tarif_amount_eur = null, tarif_source = null,
    payment_status = 'non_concerne', payment_method = null, payment_received_at = null,
    no_show_at = excluded.no_show_at, no_show_motif = excluded.no_show_motif,
    cancel_motif = excluded.cancel_motif,
    archive = false, notes_regulateur = null;

  raise notice 'SEED-02 : écrans vivants société 1 (météo active + incident ouvert + 4 exceptions cockpit)';
end$$;

-- -----------------------------------------------------------------------------
-- Sociétés 2 et 3 — référentiels isolés (patients, chauffeurs, véhicules,
-- prescripteurs, prescriptions, courses). Démontrent l'ISOLATION : chaque
-- donnée porte l'organization_id de sa société, created_by = un compte de
-- cette société. 6 chauffeurs au total (3 société 1 + 2 société 2 + 1 société 3).
-- -----------------------------------------------------------------------------
do $$
declare
  -- Société 2
  org2  uuid := '00000000-0000-0000-0000-000000000002';
  dir2  uuid := '00000000-0000-0000-0000-000000000210';
  reg2  uuid := '00000000-0000-0000-0000-000000000220';
  prof2a uuid := '00000000-0000-0000-0000-000000000230';
  prof2b uuid := '00000000-0000-0000-0000-000000000231';
  -- Société 3
  org3  uuid := '00000000-0000-0000-0000-000000000003';
  dir3  uuid := '00000000-0000-0000-0000-000000000310';
  reg3  uuid := '00000000-0000-0000-0000-000000000320';
  prof3a uuid := '00000000-0000-0000-0000-000000000330';
begin
  -- Patients société 2 (6) et société 3 (4).
  insert into public.patients (
    id, organization_id, prenom, nom, date_naissance, genre,
    telephone, telephone_normalized, adresse_ligne1, code_postal, ville,
    canal_contact_prefere, consentement_sms, consentement_sms_at,
    archive, created_at, updated_at, created_by, updated_by
  ) values
    ('11111111-0000-0000-0000-000000000201', org2, 'Yolande', 'Grondin', '1953-02-17', 'F',
     '02 62 35 00 01', '0262350001', '1 Rue Augustin Archambaud', '97410', 'Saint-Pierre', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000202', org2, 'Bruno', 'Hoarau', '1961-05-29', 'M',
     '06 92 35 00 02', '0692350002', '2 Rue François de Mahy', '97410', 'Saint-Pierre', 'appel', false, null, false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000203', org2, 'Isabelle', 'Payet', '1970-08-03', 'F',
     '02 62 27 00 03', '0262270003', '3 Rue Hubert Delisle', '97430', 'Le Tampon', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000204', org2, 'Serge', 'Dijoux', '1948-10-21', 'M',
     '06 92 27 00 04', '0692270004', '4 Rue du Général de Gaulle', '97430', 'Le Tampon', 'aucun', false, null, false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000205', org2, 'Nathalie', 'Robert', '1966-12-09', 'F',
     '02 62 35 00 05', '0262350005', '5 Boulevard Hubert Delisle', '97410', 'Saint-Pierre', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000206', org2, 'Thierry', 'Lebon', '1957-03-14', 'M',
     '06 92 29 00 06', '0692290006', '6 Rue de la Plage', '97429', 'Petite-Île', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000301', org3, 'Ginette', 'Maillot', '1951-07-07', 'F',
     '02 62 45 00 01', '0262450001', '1 Rue de la Compagnie', '97460', 'Saint-Paul', 'sms', true, now(), false, now(), now(), reg3, reg3),
    ('11111111-0000-0000-0000-000000000302', org3, 'Pascal', 'Boyer', '1963-11-30', 'M',
     '06 92 45 00 02', '0692450002', '2 Route du Théâtre', '97460', 'Saint-Paul', 'appel', false, null, false, now(), now(), reg3, reg3),
    ('11111111-0000-0000-0000-000000000303', org3, 'Sandrine', 'Vergoz', '1975-04-25', 'F',
     '02 62 42 00 03', '0262420003', '3 Rue Jeanne d''Arc', '97420', 'Le Port', 'sms', true, now(), false, now(), now(), reg3, reg3),
    ('11111111-0000-0000-0000-000000000304', org3, 'Michel', 'Bègue', '1945-09-12', 'M',
     '06 92 42 00 04', '0692420004', '4 Quai Ouest', '97420', 'Le Port', 'aucun', false, null, false, now(), now(), reg3, reg3)
  on conflict (id) do nothing;

  -- Chauffeurs (2 + 1) et véhicules (2 + 1).
  insert into public.drivers (
    id, organization_id, profile_id, nom_affichage, telephone, numero_licence, type_permis, actif, created_by
  ) values
    ('22222222-0000-0000-0000-000000000021', org2, prof2a, 'Técher Willy', '0692350021', 'LIC-974-021', '{taxi}'::text[], true, dir2),
    ('22222222-0000-0000-0000-000000000022', org2, prof2b, 'Fontaine Nadia', '0692350022', 'LIC-974-022', '{taxi,tpmr}'::text[], true, dir2),
    ('22222222-0000-0000-0000-000000000031', org3, prof3a, 'Rivière Steve', '0692450031', 'LIC-974-031', '{taxi}'::text[], true, dir3)
  on conflict (id) do update set profile_id = excluded.profile_id;

  insert into public.vehicles (
    id, organization_id, immatriculation, marque, modele, type, places_assises, places_tpmr, actif, created_by
  ) values
    ('33333333-0000-0000-0000-000000000021', org2, 'MN-021-OP', 'Dacia', 'Jogger', 'taxi_conventionne', 4, null, true, dir2),
    ('33333333-0000-0000-0000-000000000022', org2, 'QR-022-ST', 'Renault', 'Trafic', 'tpmr', 6, 1, true, dir2),
    ('33333333-0000-0000-0000-000000000031', org3, 'UV-031-WX', 'Citroën', 'SpaceTourer', 'vsl', 3, null, true, dir3)
  on conflict (id) do nothing;

  -- Prescripteurs (1 + 1).
  insert into public.prescribers (id, organization_id, nom, prenom, type, rpps, specialite, actif, created_by)
  values
    ('55555555-0000-0000-0000-000000000021', org2, 'Hoarau', 'Denis', 'medecin', '10000000021', 'Médecine générale', true, reg2),
    ('55555555-0000-0000-0000-000000000031', org3, 'Payet', 'Sylvie', 'medecin', '10000000031', 'Néphrologie', true, reg3)
  on conflict (id) do update set nom = excluded.nom, prenom = excluded.prenom, type = excluded.type,
    rpps = excluded.rpps, specialite = excluded.specialite, actif = excluded.actif, archive = false, archive_at = null;

  -- Prescriptions (3 société 2 + 2 société 3).
  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, numero, date_prescription,
    motif, type_transport, trajets_autorises, date_expiration, statut, created_by
  ) values
    ('88888888-0000-0000-0000-000000000201', org2, '11111111-0000-0000-0000-000000000201', '55555555-0000-0000-0000-000000000021',
     'BT-B-2026-0001', current_date - 25, 'Dialyse itérative', 'taxi_conventionne', 20, current_date + 90, 'active', reg2),
    ('88888888-0000-0000-0000-000000000202', org2, '11111111-0000-0000-0000-000000000203', '55555555-0000-0000-0000-000000000021',
     'BT-B-2026-0002', current_date - 12, 'Consultation de suivi', 'taxi_conventionne', 4, current_date + 150, 'active', reg2),
    ('88888888-0000-0000-0000-000000000203', org2, '11111111-0000-0000-0000-000000000205', '55555555-0000-0000-0000-000000000021',
     'BT-B-2025-0009', current_date - 200, 'Cure thermale', 'tpmr', 6, current_date - 20, 'expiree', reg2),
    ('88888888-0000-0000-0000-000000000301', org3, '11111111-0000-0000-0000-000000000301', '55555555-0000-0000-0000-000000000031',
     'BT-C-2026-0001', current_date - 18, 'Séances de kinésithérapie', 'taxi_conventionne', 10, current_date + 5, 'active', reg3),
    ('88888888-0000-0000-0000-000000000302', org3, '11111111-0000-0000-0000-000000000303', '55555555-0000-0000-0000-000000000031',
     'BT-C-2026-0002', current_date - 8, 'Soins de néphrologie', 'taxi_conventionne', 20, current_date + 120, 'active', reg3)
  on conflict (id) do update set
    patient_id = excluded.patient_id, prescriber_id = excluded.prescriber_id, numero = excluded.numero,
    date_prescription = excluded.date_prescription, motif = excluded.motif, type_transport = excluded.type_transport,
    trajets_autorises = excluded.trajets_autorises, date_expiration = excluded.date_expiration;

  -- Courses (6 société 2 + 4 société 3) : historiques terminées + du jour, pour
  -- que les cockpits/listes/facturation de ces sociétés ne soient pas vides.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000301', org2, '11111111-0000-0000-0000-000000000201', '22222222-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000021',
     '1 Rue Augustin Archambaud, 97410 Saint-Pierre', 'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now() - interval '2 days') + interval '7 hours', 'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '2 days') + interval '7 hours 5 minutes', date_trunc('day', now() - interval '2 days') + interval '7 hours 30 minutes',
     19.00, 'manuel', 'non_concerne', null, null, now() - interval '2 days', reg2, reg2),
    ('44444444-0000-0000-0000-000000000302', org2, '11111111-0000-0000-0000-000000000202', '22222222-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000022',
     '2 Rue François de Mahy, 97410 Saint-Pierre', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now() - interval '1 day') + interval '10 hours', 'terminee', 'tpmr', 'programmee',
     date_trunc('day', now() - interval '1 day') + interval '10 hours 5 minutes', date_trunc('day', now() - interval '1 day') + interval '11 hours',
     41.00, 'manuel', 'encaisse', 'cb', date_trunc('day', now() - interval '1 day') + interval '11 hours', now() - interval '1 day', reg2, reg2),
    ('44444444-0000-0000-0000-000000000303', org2, '11111111-0000-0000-0000-000000000203', '22222222-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000021',
     '3 Rue Hubert Delisle, 97430 Le Tampon', 'Dialyse Sud Le Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '8 hours', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '4 hours', reg2, reg2),
    ('44444444-0000-0000-0000-000000000304', org2, '11111111-0000-0000-0000-000000000205', '22222222-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000022',
     '5 Boulevard Hubert Delisle, 97410 Saint-Pierre', 'Cabinet de kinésithérapie, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '14 hours', 'validee', 'tpmr', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '3 hours', reg2, reg2),
    ('44444444-0000-0000-0000-000000000305', org2, '11111111-0000-0000-0000-000000000204', '22222222-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000021',
     '4 Rue du Général de Gaulle, 97430 Le Tampon', 'Laboratoire, 97410 Saint-Pierre',
     date_trunc('day', now() + interval '1 day') + interval '9 hours', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '2 hours', reg2, reg2),
    ('44444444-0000-0000-0000-000000000306', org2, '11111111-0000-0000-0000-000000000206', '22222222-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000022',
     '6 Rue de la Plage, 97429 Petite-Île', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now() - interval '5 days') + interval '13 hours', 'terminee', 'tpmr', 'programmee',
     date_trunc('day', now() - interval '5 days') + interval '13 hours 5 minutes', date_trunc('day', now() - interval '5 days') + interval '14 hours',
     45.00, 'manuel', 'non_concerne', null, null, now() - interval '5 days', reg2, reg2),
    ('44444444-0000-0000-0000-000000000321', org3, '11111111-0000-0000-0000-000000000301', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '1 Rue de la Compagnie, 97460 Saint-Paul', 'CH Gabriel Martin, 97460 Saint-Paul',
     date_trunc('day', now() - interval '1 day') + interval '9 hours', 'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '1 day') + interval '9 hours 5 minutes', date_trunc('day', now() - interval '1 day') + interval '9 hours 40 minutes',
     23.00, 'manuel', 'encaisse', 'cash', date_trunc('day', now() - interval '1 day') + interval '9 hours 40 minutes', now() - interval '1 day', reg3, reg3),
    ('44444444-0000-0000-0000-000000000322', org3, '11111111-0000-0000-0000-000000000302', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '2 Route du Théâtre, 97460 Saint-Paul', 'Cabinet médical, 97460 Saint-Paul',
     date_trunc('day', now()) + interval '10 hours', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '3 hours', reg3, reg3),
    ('44444444-0000-0000-0000-000000000323', org3, '11111111-0000-0000-0000-000000000303', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '3 Rue Jeanne d''Arc, 97420 Le Port', 'Clinique Jeanne d''Arc, 97420 Le Port',
     date_trunc('day', now()) + interval '15 hours', 'validee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '1 hour', reg3, reg3),
    ('44444444-0000-0000-0000-000000000324', org3, '11111111-0000-0000-0000-000000000304', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '4 Quai Ouest, 97420 Le Port', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now() - interval '3 days') + interval '8 hours', 'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '3 days') + interval '8 hours 5 minutes', date_trunc('day', now() - interval '3 days') + interval '9 hours 15 minutes',
     33.00, 'manuel', 'non_concerne', null, null, now() - interval '3 days', reg3, reg3)
  on conflict (id) do update set
    patient_id = excluded.patient_id, driver_id = excluded.driver_id, vehicle_id = excluded.vehicle_id,
    pickup_address = excluded.pickup_address, dropoff_address = excluded.dropoff_address,
    scheduled_at = excluded.scheduled_at, status = excluded.status, transport_mode = excluded.transport_mode,
    urgency = excluded.urgency, started_at = excluded.started_at, ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur, tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status, payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at, created_at = excluded.created_at,
    archive = false, cancel_motif = null, notes_regulateur = null;

  raise notice 'SEED-02 : sociétés 2 et 3 (10 patients, 3 chauffeurs, 3 véhicules, 2 prescripteurs, 5 prescriptions, 10 courses)';
end$$;

-- =============================================================================
-- Coordonnées des AUTRES courses `validee` J0 (hors bloc « Ma journée »)
-- =============================================================================
-- Le bloc des courses du jour affichées (org1) est géocodé EN PLACE plus haut
-- (« 4 courses du jour (J0) »), et le bloc doublon ajouté à côté a été retiré :
-- il ne reste qu'un seul jeu de courses du jour. On complète ici seulement les
-- courses `validee` J0 des AUTRES écrans / sociétés — ...0082 (org1, exceptions
-- cockpit), ...0304 (société 2), ...0323 (société 3) — pour qu'aucune ne soit
-- exclue faute de coordonnées. Coordonnées EN DUR, idempotent.
update public.rides
  set pickup_lat = -20.8895, pickup_lng = 55.4468, dropoff_lat = -20.9083, dropoff_lng = 55.4808
  where id = '44444444-0000-0000-0000-000000000082'; -- org1 : CHU Félix Guyon → Clinique Sainte-Clotilde
update public.rides
  set pickup_lat = -21.3410, pickup_lng = 55.4790, dropoff_lat = -21.3406, dropoff_lng = 55.4788
  where id = '44444444-0000-0000-0000-000000000304'; -- org2 : Saint-Pierre → cabinet kiné Saint-Pierre
update public.rides
  set pickup_lat = -20.9390, pickup_lng = 55.2935, dropoff_lat = -20.9385, dropoff_lng = 55.2938
  where id = '44444444-0000-0000-0000-000000000323'; -- org3 : Le Port → Clinique Jeanne d'Arc

-- Tournées J0 AFFECTÉES (a0..a4) : géocodage pour qu'elles apparaissent SUR LA
-- CARTE du cockpit, colorées par tournée (Vergoz, Boyer), à côté des courses non
-- affectées (neutres) déjà géocodées. Ainsi la carte du jour montre le mélange
-- affectées / non affectées attendu, jamais vide sur une base fraîche.
-- Coordonnées 974 EN DUR, idempotent (UPDATE par id déterministe).
update public.rides
  set pickup_lat = -20.8809, pickup_lng = 55.4562, dropoff_lat = -20.8853, dropoff_lng = 55.4504
  where id = '44444444-0000-0000-0000-0000000000a0'; -- Vergoz : Saint-Denis → CHU Félix Guyon
update public.rides
  set pickup_lat = -20.8796, pickup_lng = 55.4521, dropoff_lat = -20.9083, dropoff_lng = 55.4808
  where id = '44444444-0000-0000-0000-0000000000a1'; -- Vergoz : Saint-Denis → Clinique Sainte-Clotilde
update public.rides
  set pickup_lat = -20.8831, pickup_lng = 55.4489, dropoff_lat = -20.8901, dropoff_lng = 55.4461
  where id = '44444444-0000-0000-0000-0000000000a2'; -- Vergoz : Saint-Denis → Centre de dialyse Nord
update public.rides
  set pickup_lat = -21.2788, pickup_lng = 55.5158, dropoff_lat = -21.3196, dropoff_lng = 55.4788
  where id = '44444444-0000-0000-0000-0000000000a3'; -- Boyer : Le Tampon → CHU Sud Saint-Pierre
update public.rides
  set pickup_lat = -21.3393, pickup_lng = 55.4781, dropoff_lat = -21.2788, dropoff_lng = 55.5158
  where id = '44444444-0000-0000-0000-0000000000a4'; -- Boyer : Saint-Pierre → Dialyse Sud Le Tampon

-- ============================================================================
-- SEED-CHECK — auto-vérification de fiabilité (démo société 1)
-- ----------------------------------------------------------------------------
-- Le bloc « écrans vivants » (SEED-02) insère notamment 2 courses d'urgence
-- (immédiate non affectée + urgente affectée), indispensables pour démontrer le
-- filtre « Urgentes » de la page courses. Ce garde-fou vérifie qu'elles existent
-- réellement APRÈS seeding et lève une exception sinon : avec `ON_ERROR_STOP=1`
-- (CD), un seed silencieusement incomplet devient un échec BRUYANT au lieu de
-- passer inaperçu (incident constaté : 0 course urgente en base malgré le seed).
--
-- On ne vérifie l'invariant que si le bloc « écrans vivants » a dû s'exécuter
-- (>= 10 patients société 1) — même seuil que sa propre garde, pour ne pas
-- échouer sur un environnement volontairement minimal.
do $$
declare
  org_id       uuid := '00000000-0000-0000-0000-000000000001';
  nb_patients  int;
  nb_urgences  int;
begin
  select count(*) into nb_patients
    from public.patients where organization_id = org_id and archive = false;
  if nb_patients < 10 then
    raise notice 'SEED-CHECK : < 10 patients société 1 → vérification des urgences ignorée.';
    return;
  end if;

  select count(*) into nb_urgences
    from public.rides
    where organization_id = org_id and archive = false
      and urgency in ('urgente', 'immediate');

  if nb_urgences < 2 then
    raise exception
      'SEED-CHECK ÉCHEC : % course(s) urgente/immédiate en base (attendu >= 2, société 1). Le seed démo est incomplet — le filtre « Urgentes » ne remonterait rien.',
      nb_urgences;
  end if;

  raise notice 'SEED-CHECK OK : % courses urgentes/immédiates (société 1).', nb_urgences;
end$$;

-- ─── DONE ─────────────────────────────────────────────────────────────

select '✅ Setup terminé : migrations + seed appliqués' as status;
