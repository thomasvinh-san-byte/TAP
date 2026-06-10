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
