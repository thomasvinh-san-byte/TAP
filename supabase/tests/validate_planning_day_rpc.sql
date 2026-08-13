-- =============================================================================
-- Tests pgTAP — RPC validate_planning_day (Module 5.12 lot D, atomicité)
-- =============================================================================
-- Couverture :
--   - validation + figeage atomiques (validation + instantané créés ensemble)
--   - idempotence : 2ᵉ appel → already_validated, aucun doublon, instantané figé
--   - SECURITY INVOKER : un chauffeur ne peut pas valider (RLS INSERT refuse)
--   - cloisonnement : une autre org valide son propre jour (0 course), sans voir
--     la validation de la 1re org
-- =============================================================================

begin;

select plan(8);

do $$ begin
  perform test_fixtures.setup(
    with_second_org => true, second_org_role => 'dirigeant', with_chauffeur => true
  );
end $$;

-- Patient + 1 course ferme (validee) + 1 course annulée (exclue de l'instantané)
-- le 2026-06-15 (fuseau Réunion).
insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'Hoarau', 'Patrick', '1980-01-23', '12 rue Pasteur',
   '97400', 'Saint-Denis', 'appel');

insert into public.rides
  (id, organization_id, patient_id, scheduled_at, status, pickup_address,
   dropoff_address, created_by, updated_by)
values
  ('a1a1a1a1-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   '2026-06-15T06:00:00+04', 'validee', '12 rue Pasteur', 'CHU Bellepierre',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('a1a1a1a1-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   '2026-06-15T08:00:00+04', 'annulee_patient', '12 rue Pasteur', 'CHU',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc');

set local role authenticated;

-- 1. alpha-reg valide le 2026-06-15 → 1 course figée (l'annulée est exclue).
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select snapshot_count from public.validate_planning_day('2026-06-15')),
  1,
  'validation : 1 course prévue figée (course annulée exclue)'
);

-- 2. une validation existe pour (org, jour).
select is(
  (select count(*)::int from public.planning_validations
     where planning_date = '2026-06-15'),
  1,
  'une validation créée pour le jour'
);

-- 3. l'instantané contient exactement la course ferme.
select is(
  (select count(*)::int from public.planning_validation_rides pvr
     join public.planning_validations pv on pv.id = pvr.validation_id
    where pv.planning_date = '2026-06-15'),
  1,
  'instantané figé atomiquement avec la validation'
);

-- 4. re-validation idempotente.
select is(
  (select already_validated from public.validate_planning_day('2026-06-15')),
  true,
  're-validation : already_validated = true'
);

-- 5. pas de doublon de validation.
select is(
  (select count(*)::int from public.planning_validations
     where planning_date = '2026-06-15'),
  1,
  're-validation ne crée pas de doublon'
);

-- 6. instantané non re-figé (toujours 1 ligne).
select is(
  (select count(*)::int from public.planning_validation_rides pvr
     join public.planning_validations pv on pv.id = pvr.validation_id
    where pv.planning_date = '2026-06-15'),
  1,
  're-validation ne re-fige pas l''instantané'
);

-- 7. un chauffeur ne peut pas valider (RLS INSERT refuse → 42501).
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ select public.validate_planning_day('2026-06-20') $$,
  '42501', null,
  'chauffeur refusé pour valider le planning (RLS)'
);

-- 8. cloisonnement : bravo-dir valide SON jour (0 course), ne voit pas la
-- validation d'Alpha.
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select snapshot_count from public.validate_planning_day('2026-06-15')),
  0,
  'bravo-dir valide son propre jour (0 course), cloisonnement respecté'
);

select * from finish();
rollback;
