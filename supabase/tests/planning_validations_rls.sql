-- =============================================================================
-- Tests pgTAP — RLS planning_validations + planning_validation_rides (5.12 lot D)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée sur les deux tables
--   - INSERT régulateur OK ; chauffeur refusé ; cross-org refusé (WITH CHECK)
--   - SELECT same-org OK ; cross-org strict (0 ligne)
--   - Idempotence : 2ᵉ validation même (org, jour) → violation d'unicité
--   - Instantané : INSERT régulateur OK ; chauffeur refusé
--   - DELETE refusé pour tous (fait figé) ; grants ; anon refusé
-- =============================================================================

begin;

select plan(15);

do $$ begin
  perform test_fixtures.setup(
    with_second_org => true, second_org_role => 'dirigeant', with_chauffeur => true
  );
end $$;

-- Patient + course Alpha (FK de l'instantané).
insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'Hoarau', 'Patrick', '1980-01-23', '12 rue Pasteur',
   '97400', 'Saint-Denis', 'appel');

insert into public.rides
  (id, organization_id, patient_id, scheduled_at, pickup_address, dropoff_address,
   created_by, updated_by)
values
  ('a1a1a1a1-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   '2026-06-15T06:00:00+04', '12 rue Pasteur', 'CHU Bellepierre',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- 1-4. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.planning_validations'::regclass),
  'RLS activée sur planning_validations'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.planning_validations'::regclass),
  'RLS forcée sur planning_validations'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.planning_validation_rides'::regclass),
  'RLS activée sur planning_validation_rides'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.planning_validation_rides'::regclass),
  'RLS forcée sur planning_validation_rides'
);

set local role authenticated;

-- 5. alpha-reg INSERT validation OK
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.planning_validations
       (id, organization_id, planning_date, validated_by)
     values
       ('b2b2b2b2-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', '2026-06-15',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg INSERT validation planning OK'
);

-- 6. alpha-reg SELECT same-org voit sa validation
select is(
  (select count(*)::int from public.planning_validations),
  1,
  'alpha-reg voit sa validation'
);

-- 7. bravo-dir ne voit rien (cross-tenant strict)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.planning_validations),
  0,
  'bravo-dir ne voit aucune validation Alpha (cross-tenant strict)'
);

-- 8. bravo-dir INSERT cross-org dans Alpha refusé (WITH CHECK)
select throws_ok(
  $$ insert into public.planning_validations
       (organization_id, planning_date, validated_by)
     values
       ('11111111-1111-1111-1111-111111111111', '2026-06-16',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null,
  'bravo-dir refusé INSERT validation cross-org (WITH CHECK)'
);

-- 9. alpha-chauffeur INSERT refusé (rôle non autorisé)
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ insert into public.planning_validations
       (organization_id, planning_date, validated_by)
     values
       ('11111111-1111-1111-1111-111111111111', '2026-06-17',
        'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501', null,
  'alpha-chauffeur refusé INSERT validation (rôle non autorisé)'
);

-- 10. Idempotence : 2ᵉ validation même (org, jour) → violation d'unicité
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.planning_validations
       (organization_id, planning_date, validated_by)
     values
       ('11111111-1111-1111-1111-111111111111', '2026-06-15',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '23505', null,
  '2ᵉ validation même (org, jour) refusée (unicité = idempotence)'
);

-- 11. alpha-reg INSERT instantané OK
select lives_ok(
  $$ insert into public.planning_validation_rides
       (validation_id, organization_id, ride_id, scheduled_at, status)
     values
       ('b2b2b2b2-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'a1a1a1a1-0000-0000-0000-000000000001',
        '2026-06-15T06:00:00+04', 'validee') $$,
  'alpha-reg INSERT instantané de course OK'
);

-- 12. alpha-chauffeur INSERT instantané refusé (rôle non autorisé)
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ insert into public.planning_validation_rides
       (validation_id, organization_id, ride_id, scheduled_at, status)
     values
       ('b2b2b2b2-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'a1a1a1a1-0000-0000-0000-000000000001',
        '2026-06-15T06:00:00+04', 'validee') $$,
  '42501', null,
  'alpha-chauffeur refusé INSERT instantané (rôle non autorisé)'
);

-- 13. DELETE validation refusé pour tous (fait figé)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.planning_validations
       where id = 'b2b2b2b2-0000-0000-0000-000000000001' $$,
  '42501', null,
  'DELETE validation refusé (fait figé)'
);

-- 14-15. Grants
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.planning_validations', 'SELECT')
    and has_table_privilege('authenticated', 'public.planning_validations', 'INSERT')
    and not has_table_privilege('authenticated', 'public.planning_validations', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.planning_validations', 'DELETE')
    and not has_table_privilege('anon', 'public.planning_validations', 'SELECT'),
  'Grants planning_validations : SELECT/INSERT ; pas UPDATE/DELETE ; anon refusé'
);
select ok(
  has_table_privilege('authenticated', 'public.planning_validation_rides', 'SELECT')
    and has_table_privilege('authenticated', 'public.planning_validation_rides', 'INSERT')
    and not has_table_privilege('authenticated', 'public.planning_validation_rides', 'DELETE')
    and not has_table_privilege('anon', 'public.planning_validation_rides', 'SELECT'),
  'Grants planning_validation_rides : SELECT/INSERT ; pas DELETE ; anon refusé'
);

select * from finish();
rollback;
