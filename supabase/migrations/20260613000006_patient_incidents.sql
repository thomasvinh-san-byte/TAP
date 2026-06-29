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
