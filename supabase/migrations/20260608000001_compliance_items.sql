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
