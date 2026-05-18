-- =============================================================================
-- Migration — Performance : RLS wrapping + FK indexes hot path (Phase 04.7-bis-perf)
-- =============================================================================
-- Phase A diagnostic Supabase MCP (lecture seule) a identifié :
--   - 25 FKs sans index (5 hot path = jointures listes patients/courses)
--   - pg_trgm + index trigram patients déjà actifs (pas la cause)
--   - 44 policies sur 18 tables utilisent current_organization_id() SANS
--     wrapping (SELECT ...) → fonction ré-évaluée per-row au lieu d'une fois
--     via initPlan PostgreSQL
--
-- Baseline mesurée Firefox Network tab preview Vercel :
--   - Recherche patient autocomplete : 828-1214ms par keystroke
--   - Navigation /patients : 721ms
--   - Navigation /courses : 865ms + 794-1021ms data fetch
--
-- Cible post-migration :
--   - Recherche patient : <100ms (idéal 30-50ms)
--   - Navigation pages liste : <300ms
--
-- Sources :
--   - Supabase docs : https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--   - I Love Blogs (RLS performance) : wrapping (SELECT auth.uid()) speedup 100x
--   - PostgreSQL initPlan : sous-requête simple évaluée une fois
--
-- Sémantique : préservée à 100% (uniquement wrapping fonctions stables, pas
-- de changement de comportement). Les rows visibles avant/après sont
-- identiques pour un utilisateur donné.
--
-- Refs : DEC-032 (CD push exclusif), DEC-041 N/A, V3 sémantique préservée.
-- =============================================================================

-- =============================================================================
-- SECTION A — FK indexes hot path (additif, safe)
-- =============================================================================

-- rides.vehicle_id : utilisé en jointure liste courses (patients_safe → rides → vehicles)
create index if not exists rides_vehicle_id_idx
  on public.rides (vehicle_id)
  where vehicle_id is not null;

-- ride_draft.organization_id + patient_id : utilisés draft queue régulateur
create index if not exists ride_draft_organization_id_idx
  on public.ride_draft (organization_id);

create index if not exists ride_draft_patient_id_idx
  on public.ride_draft (patient_id)
  where patient_id is not null;

-- patient_constraint.organization_id : utilisé jointure patient drawer
create index if not exists patient_constraint_organization_id_idx
  on public.patient_constraint (organization_id);

-- patient_operational_note.organization_id : utilisé jointure patient drawer
create index if not exists patient_operational_note_organization_id_idx
  on public.patient_operational_note (organization_id);

-- =============================================================================
-- SECTION B — current_organization_id() : wrapping interne auth.uid()
-- =============================================================================
-- Optimisation interne : auth.uid() est appelé une fois par invocation.
-- Combiné avec le wrapping externe (SELECT current_organization_id()),
-- le double effet initPlan élimine la cascade per-row.

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid())
    and actif is true
  limit 1;
$$;

comment on function public.current_organization_id() is
  'Phase 04.7-bis-perf : auth.uid() wrappé (SELECT ...) interne pour initPlan optimization. STABLE garde la cache résultats per-statement.';

-- =============================================================================
-- SECTION C — Wrapping (SELECT current_organization_id()) sur policies hot path
-- =============================================================================
-- Sémantique IDENTIQUE — uniquement le wrapping. PostgreSQL traite la
-- sous-requête comme initPlan stable et l'évalue UNE FOIS par statement
-- au lieu d'une fois par row examiné.

-- ─── patients ────────────────────────────────────────────────────────────────
drop policy if exists patients_select_same_org on public.patients;
create policy patients_select_same_org on public.patients
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists patients_insert_regulateur on public.patients;
create policy patients_insert_regulateur on public.patients
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists patients_update_regulateur on public.patients;
create policy patients_update_regulateur on public.patients
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = (select public.current_organization_id()));

-- ─── rides ───────────────────────────────────────────────────────────────────
drop policy if exists rides_select_same_org on public.rides;
create policy rides_select_same_org on public.rides
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists rides_insert_regulateur_dirigeant on public.rides;
create policy rides_insert_regulateur_dirigeant on public.rides
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and created_by = (select auth.uid())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists rides_update_regulateur_dirigeant on public.rides;
create policy rides_update_regulateur_dirigeant on public.rides
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = (select public.current_organization_id()));

drop policy if exists rides_update_chauffeur_own_rides on public.rides;
create policy rides_update_chauffeur_own_rides on public.rides
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = (select auth.uid()) and archive = false
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = (select auth.uid()) and archive = false
    )
  );

-- ─── drivers ─────────────────────────────────────────────────────────────────
drop policy if exists drivers_select_same_org on public.drivers;
create policy drivers_select_same_org on public.drivers
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists drivers_insert_admin_or_regulateur on public.drivers;
create policy drivers_insert_admin_or_regulateur on public.drivers
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  );

drop policy if exists drivers_update_admin_or_regulateur on public.drivers;
create policy drivers_update_admin_or_regulateur on public.drivers
  for update to authenticated
  using (organization_id = (select public.current_organization_id()))
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  );

-- ─── vehicles ────────────────────────────────────────────────────────────────
drop policy if exists vehicles_select_same_org on public.vehicles;
create policy vehicles_select_same_org on public.vehicles
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists vehicles_insert_dirigeant on public.vehicles;
create policy vehicles_insert_dirigeant on public.vehicles
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

drop policy if exists vehicles_update_dirigeant on public.vehicles;
create policy vehicles_update_dirigeant on public.vehicles
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = (select public.current_organization_id()));

-- ─── pois_metier ─────────────────────────────────────────────────────────────
drop policy if exists pois_metier_select_same_org on public.pois_metier;
create policy pois_metier_select_same_org on public.pois_metier
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists pois_metier_modify_admin_or_regulateur on public.pois_metier;
create policy pois_metier_modify_admin_or_regulateur on public.pois_metier
  for all to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('dirigeant'::public.user_role) or public.has_role('regulateur'::public.user_role))
  );

-- ─── patient_constraint ──────────────────────────────────────────────────────
drop policy if exists patient_constraint_select_same_org on public.patient_constraint;
create policy patient_constraint_select_same_org on public.patient_constraint
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists patient_constraint_insert_regulateur on public.patient_constraint;
create policy patient_constraint_insert_regulateur on public.patient_constraint
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists patient_constraint_delete_regulateur on public.patient_constraint;
create policy patient_constraint_delete_regulateur on public.patient_constraint
  for delete to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

-- ─── patient_operational_note ────────────────────────────────────────────────
drop policy if exists patient_operational_note_select_same_org on public.patient_operational_note;
create policy patient_operational_note_select_same_org on public.patient_operational_note
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

drop policy if exists patient_operational_note_insert_regulateur on public.patient_operational_note;
create policy patient_operational_note_insert_regulateur on public.patient_operational_note
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );

drop policy if exists patient_operational_note_update_regulateur on public.patient_operational_note;
create policy patient_operational_note_update_regulateur on public.patient_operational_note
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  )
  with check (organization_id = (select public.current_organization_id()));

-- =============================================================================
-- SECTION D — search_patients RPC wrapping
-- =============================================================================
-- Le RPC est SECURITY INVOKER (RLS héritée). Le wrapping
-- (SELECT public.current_organization_id()) dans la query interne
-- s'applique sur le filtre direct (en plus du wrapping RLS Section C).

create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select lower(extensions.unaccent(q)) as qn
  )
  select p.*
  from public.patients_safe p, normalized n
  where p.organization_id = (select public.current_organization_id())
    and length(q) >= 2
    and (
      p.search_text ilike '%' || n.qn || '%'
      or p.search_text % n.qn
    )
  order by extensions.similarity(p.search_text, n.qn) desc
  limit 10;
$$;

comment on function public.search_patients(text) is
  'Phase 04.7-bis-perf : RPC recherche fuzzy patients. ILIKE %x% pour match contiens + opérateur trigram % pour ranking. Wrapping (SELECT current_organization_id()) pour initPlan PostgreSQL optimization. RLS héritée via SECURITY INVOKER.';

revoke all on function public.search_patients(text) from public;
grant execute on function public.search_patients(text) to authenticated;
