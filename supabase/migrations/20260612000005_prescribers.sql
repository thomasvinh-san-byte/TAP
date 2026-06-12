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
