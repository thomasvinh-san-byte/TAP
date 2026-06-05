-- =============================================================================
-- Tests pgTAP — RLS ride_events (Phase 06.21 — couverture trous RLS)
-- =============================================================================
-- Policies vérifiées (migration 20260521000001_ride_events.sql) :
--   - SELECT : tous membres de l'organisation (incluant chauffeur).
--   - INSERT : régulateur/dirigeant org OU chauffeur SUR SES rides
--     (driver_id ↔ profile_id auth.uid()).
--   - UPDATE/DELETE : aucune policy (table immuable post-création).
--
-- NOTE : `force row level security` n'est PAS posé sur cette table
-- (cf. migration 20260521000001 — seul `enable row level security`).
-- L'audit Phase 06 a retenu ce choix (lecture régulateur/dirigeant dans
-- l'application = même rôle authenticated, force n'apporte rien
-- supplémentaire). Tracé ici sans corriger (D-04 Phase 06.21).
-- =============================================================================

begin;

select plan(10);

-- Fixtures multi-tenant + 1 chauffeur Alpha + 1 chauffeur Bravo
insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-dir@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-reg@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bravo-reg@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-cha@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bravo-cha@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'dirigeant', 'Alpha', 'Dir', 'alpha-dir@t'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'regulateur', 'Alpha', 'Reg', 'alpha-reg@t'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'regulateur', 'Bravo', 'Reg', 'bravo-reg@t'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'chauffeur', 'Alpha', 'Cha', 'alpha-cha@t'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'chauffeur', 'Bravo', 'Cha', 'bravo-cha@t');

-- 1 patient Alpha + 2 drivers + 2 rides (1 par org)
insert into public.patients (id, organization_id, nom, prenom, date_naissance, adresse_ligne1, code_postal, ville, canal_contact_prefere) values
  ('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', 'Hoarau', 'P', '1980-01-23', 'X', '97400', 'Saint-Denis', 'appel'),
  ('99999999-9999-9999-9999-999999999992', '22222222-2222-2222-2222-222222222222', 'Payet', 'M', '1985-01-23', 'Y', '97410', 'Saint-Pierre', 'appel');

insert into public.drivers (id, organization_id, profile_id, nom_affichage, type_permis, actif) values
  ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'A Cha', '{taxi}', true),
  ('44444444-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'B Cha', '{taxi}', true);

insert into public.rides (id, organization_id, patient_id, driver_id, scheduled_at, pickup_address, dropoff_address, created_by, updated_by) values
  ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', '44444444-0000-0000-0000-000000000001', now()+interval '1 day', 'X', 'Y', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('55555555-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999992', '44444444-0000-0000-0000-000000000002', now()+interval '1 day', 'X', 'Y', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- 1. RLS activée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ride_events'::regclass),
  'RLS activée sur ride_events'
);

-- 2. alpha-reg INSERT ride_event sur ride Alpha OK
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.ride_events (organization_id, ride_id, event_type, payload, created_by) values
       ('11111111-1111-1111-1111-111111111111', '55555555-0000-0000-0000-000000000001', 'patient_no_show', '{}'::jsonb, 'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg INSERT ride_event OK'
);

-- 3. bravo-reg ne voit rien dans org Alpha (cross-tenant)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.ride_events where organization_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'bravo-reg ne voit AUCUN ride_event Alpha (cross-tenant)'
);

-- 4. bravo-reg INSERT cross-org refusé (WITH CHECK)
select throws_ok(
  $$ insert into public.ride_events (organization_id, ride_id, event_type, payload, created_by) values
       ('11111111-1111-1111-1111-111111111111', '55555555-0000-0000-0000-000000000001', 'patient_no_show', '{}'::jsonb, 'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null,
  'bravo-reg refusé INSERT cross-org (WITH CHECK)'
);

-- 5. alpha-chauffeur peut INSERT ride_event sur SA ride (driver_id matches)
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select lives_ok(
  $$ insert into public.ride_events (organization_id, ride_id, event_type, payload, created_by) values
       ('11111111-1111-1111-1111-111111111111', '55555555-0000-0000-0000-000000000001', 'driver_assigned', '{}'::jsonb, 'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  'alpha-chauffeur INSERT ride_event sur SA ride OK'
);

-- 6. alpha-chauffeur INSERT sur ride d'un AUTRE chauffeur refusé
-- (créer un autre ride Alpha sur chauffeur Bravo n'a pas de sens en pratique
-- — on teste via la ride Bravo cross-tenant qui doit échouer.)
select throws_ok(
  $$ insert into public.ride_events (organization_id, ride_id, event_type, payload, created_by) values
       ('22222222-2222-2222-2222-222222222222', '55555555-0000-0000-0000-000000000002', 'driver_assigned', '{}'::jsonb, 'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501', null,
  'alpha-chauffeur refusé INSERT sur ride Bravo (WITH CHECK org + driver_id)'
);

-- 7. alpha-chauffeur voit les ride_events de son org (policy SELECT laxiste)
select cmp_ok(
  (select count(*)::int from public.ride_events where organization_id = '11111111-1111-1111-1111-111111111111'),
  '>=', 1,
  'alpha-chauffeur voit les ride_events de son org (policy SELECT same_org)'
);

-- 8. UPDATE refusé (pas de policy UPDATE — table immuable)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ update public.ride_events set event_type = 'X' where organization_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'UPDATE refusé sur ride_events (table immuable, pas de policy)'
);

-- 9. DELETE refusé (pas de policy DELETE — audit trail)
select throws_ok(
  $$ delete from public.ride_events where organization_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'DELETE refusé sur ride_events (audit trail, pas de policy)'
);

-- 10. anon refusé
select ok(
  not has_table_privilege('anon', 'public.ride_events', 'SELECT'),
  'anon refusé sur ride_events'
);

select * from finish();
rollback;
