-- =============================================================================
-- Tests pgTAP — RLS ride_recurrences (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260519000001_ride_recurrences.sql) :
--   - SELECT : same_org.
--   - INSERT : régulateur/dirigeant + same_org.
--   - UPDATE : régulateur/dirigeant + same_org (USING + WITH CHECK).
--   - DELETE : dirigeant uniquement + same_org.
-- =============================================================================

begin;

select plan(10);

insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'dirigeant', 'A', 'D', 'a@t'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'regulateur', 'A', 'R', 'c@t'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'regulateur', 'B', 'R', 'd@t'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'chauffeur', 'A', 'C', 'f@t');

insert into public.patients (id, organization_id, nom, prenom, date_naissance, adresse_ligne1, code_postal, ville, canal_contact_prefere) values
  ('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', 'X', 'Y', '1980-01-23', 'X', '97400', 'Saint-Denis', 'appel');

-- 1. RLS activée
select ok((select relrowsecurity from pg_class where oid = 'public.ride_recurrences'::regclass), 'RLS activée');

-- 2. alpha-reg INSERT OK
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.ride_recurrences (id, organization_id, patient_id, rrule_str, start_date, pickup_address, dropoff_address, transport_mode, urgency, created_by) values
       ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=0', current_date, 'X', 'CHU', 'taxi_conventionne', 'normale', 'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg INSERT ride_recurrence OK'
);

-- 3. bravo-reg ne voit pas la récurrence Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is((select count(*)::int from public.ride_recurrences), 0, 'bravo-reg cross-tenant : 0 récurrence');

-- 4. bravo-reg INSERT cross-org refusé
select throws_ok(
  $$ insert into public.ride_recurrences (organization_id, patient_id, rrule_str, start_date, pickup_address, dropoff_address, transport_mode, urgency, created_by) values
       ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'FREQ=WEEKLY;BYDAY=MO', current_date, 'X', 'Y', 'taxi_conventionne', 'normale', 'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null, 'bravo-reg refusé INSERT cross-org'
);

-- 5. alpha-chauffeur INSERT refusé (rôle non listé)
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ insert into public.ride_recurrences (organization_id, patient_id, rrule_str, start_date, pickup_address, dropoff_address, transport_mode, urgency, created_by) values
       ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'FREQ=WEEKLY;BYDAY=MO', current_date, 'X', 'Y', 'taxi_conventionne', 'normale', 'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501', null, 'alpha-chauffeur refusé INSERT (rôle non listé)'
);

-- 6. alpha-chauffeur peut SELECT same_org (policy SELECT laxiste)
select cmp_ok(
  (select count(*)::int from public.ride_recurrences where organization_id = '11111111-1111-1111-1111-111111111111'),
  '>=', 1, 'alpha-chauffeur voit les récurrences de son org (SELECT same_org)'
);

-- 7. alpha-chauffeur UPDATE refusé
select throws_ok(
  $$ update public.ride_recurrences set rrule_str = 'X' where id = '66666666-0000-0000-0000-000000000001' $$,
  null, null, 'alpha-chauffeur ne peut UPDATE (rôle non listé)'
);

-- 8. alpha-reg UPDATE OK
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ update public.ride_recurrences set rrule_str = 'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=8;BYMINUTE=0' where id = '66666666-0000-0000-0000-000000000001' $$,
  'alpha-reg UPDATE OK'
);

-- 9. alpha-reg DELETE refusé (seul dirigeant)
select throws_ok(
  $$ delete from public.ride_recurrences where id = '66666666-0000-0000-0000-000000000001' $$,
  null, null, 'alpha-reg refusé DELETE (seul dirigeant)'
);

-- 10. anon refusé
select ok(
  not has_table_privilege('anon', 'public.ride_recurrences', 'SELECT'),
  'anon refusé sur ride_recurrences'
);

select * from finish();
rollback;
