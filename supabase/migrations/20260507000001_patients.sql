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
