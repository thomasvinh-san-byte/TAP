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
