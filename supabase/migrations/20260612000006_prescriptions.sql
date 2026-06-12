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
