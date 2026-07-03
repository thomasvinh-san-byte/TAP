-- =============================================================================
-- Tests pgTAP — RLS ride_recurrence_exceptions (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260519000002) — toutes via subquery sur ride_recurrence_id :
--   - SELECT : ride_recurrence appartient à same_org.
--   - INSERT : same_org via FK ride_recurrence + rôle régulateur/dirigeant.
--   - UPDATE : idem.
--   - DELETE : same_org via FK + dirigeant uniquement.
-- =============================================================================

begin;

select plan(8);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true, second_org_role => 'regulateur', with_alpha_dirigeant => false); end $$;

insert into public.patients (id, organization_id, nom, prenom, date_naissance, adresse_ligne1, code_postal, ville, canal_contact_prefere) values
  ('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', 'X', 'Y', '1980-01-23', 'X', '97400', 'Saint-Denis', 'appel'),
  ('99999999-9999-9999-9999-999999999992', '22222222-2222-2222-2222-222222222222', 'X', 'Z', '1980-01-23', 'X', '97410', 'Saint-Pierre', 'appel');

insert into public.ride_recurrences (id, organization_id, patient_id, rrule_str, start_date, pickup_address, dropoff_address, transport_mode, urgency, created_by) values
  ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'FREQ=WEEKLY;BYDAY=MO', current_date, 'X', 'Y', 'taxi_conventionne', 'normale', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('66666666-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999992', 'FREQ=WEEKLY;BYDAY=TU', current_date, 'X', 'Y', 'taxi_conventionne', 'normale', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- 1. RLS activée
select ok((select relrowsecurity from pg_class where oid = 'public.ride_recurrence_exceptions'::regclass), 'RLS activée');

-- 2. alpha-reg INSERT exception sur récurrence Alpha OK
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.ride_recurrence_exceptions (ride_recurrence_id, exception_date, motif) values
       ('66666666-0000-0000-0000-000000000001', current_date + 7, 'patient_absent') $$,
  'alpha-reg INSERT exception sur récurrence Alpha OK'
);

-- 3. bravo-reg ne voit pas l'exception Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is((select count(*)::int from public.ride_recurrence_exceptions), 0, 'bravo-reg cross-tenant : 0 exception');

-- 4. bravo-reg INSERT cross-org via FK refusé (subquery échoue)
select throws_ok(
  $$ insert into public.ride_recurrence_exceptions (ride_recurrence_id, exception_date, motif) values
       ('66666666-0000-0000-0000-000000000001', current_date + 7, 'patient_absent') $$,
  null, null, 'bravo-reg refusé INSERT via FK cross-org'
);

-- 5. bravo-reg INSERT sur SA propre récurrence OK
select lives_ok(
  $$ insert into public.ride_recurrence_exceptions (ride_recurrence_id, exception_date, motif) values
       ('66666666-0000-0000-0000-000000000002', current_date + 7, 'patient_absent') $$,
  'bravo-reg INSERT exception sur récurrence Bravo OK'
);

-- 6. alpha-reg UPDATE OK
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ update public.ride_recurrence_exceptions set motif = 'patient_hospitalise' where ride_recurrence_id = '66666666-0000-0000-0000-000000000001' $$,
  'alpha-reg UPDATE exception OK'
);

-- 7. alpha-reg DELETE refusé (seul dirigeant)
select throws_ok(
  $$ delete from public.ride_recurrence_exceptions where ride_recurrence_id = '66666666-0000-0000-0000-000000000001' $$,
  null, null, 'alpha-reg refusé DELETE (seul dirigeant)'
);

-- 8. anon refusé
select ok(
  not has_table_privilege('anon', 'public.ride_recurrence_exceptions', 'SELECT'),
  'anon refusé sur ride_recurrence_exceptions'
);

select * from finish();
rollback;
