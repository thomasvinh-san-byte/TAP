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
