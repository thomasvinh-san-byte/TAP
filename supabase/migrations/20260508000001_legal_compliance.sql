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
