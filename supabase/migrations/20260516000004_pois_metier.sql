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
