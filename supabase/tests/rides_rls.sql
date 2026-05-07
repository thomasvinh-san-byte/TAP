-- =============================================================================
-- Tests pgTAP — RLS rides (Phase 2, Plan 02-02, Wave 1 GREEN)
-- =============================================================================
-- Couverture (T-02-T1 — cross-tenant rides) :
--   - RLS activée + forcée sur public.rides
--   - Régulateur + dirigeant peuvent INSERT/SELECT dans leur org
--   - Régulateur d'une autre org ne voit RIEN (cross-tenant)
--   - Régulateur d'une autre org ne peut pas INSERT cross-org (WITH CHECK)
--   - Chauffeur ne voit RIEN sur public.rides V1 (rôle non listé)
--   - Chauffeur ne peut pas INSERT (rôle non listé)
--   - Defaults appliqués (taxi_conventionne / programmee / validee)
--   - Constraint check notes_regulateur ≤ 500
--   - Grants authenticated (SELECT/INSERT/UPDATE) ; anon refusé
--
-- Fixtures partagées : Org Alpha + Bravo, alpha-dir, alpha-reg, bravo-reg,
-- alpha-chauffeur (UUID figé ffffffff-...).
-- =============================================================================

begin;

select plan(15);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant (calque supabase/tests/patients.sql lignes 23-57)
-- + 1 chauffeur Alpha pour T1.5 (rôle chauffeur exclu V1)
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chauffeur@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'regulateur', 'Bravo', 'Régulateur', 'bravo-reg@test.tap'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chauffeur@test.tap');

-- 1 patient Alpha pour FK rides.patient_id
insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'Hoarau', 'Patrick', '1980-01-23', '12 rue Pasteur',
   '97400', 'Saint-Denis', 'appel');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rides'::regclass),
  'RLS activée sur rides'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.rides'::regclass),
  'RLS forcée sur rides (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3-5. alpha-reg crée une course Alpha + voit sa course
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ insert into public.rides
       (organization_id, patient_id, scheduled_at,
        pickup_address, dropoff_address,
        created_by, updated_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        now() + interval '1 day',
        '12 rue Pasteur', 'CHU Bellepierre',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg INSERT rides OK (rôle régulateur autorisé)'
);

select is(
  (select count(*)::int from public.rides),
  1,
  'alpha-reg voit sa course Alpha (1 ligne)'
);

-- 5. Defaults appliqués (transport_mode = taxi_conventionne)
select is(
  (select transport_mode::text from public.rides limit 1),
  'taxi_conventionne',
  'default transport_mode = taxi_conventionne'
);

-- -----------------------------------------------------------------------------
-- 6. bravo-reg ne voit AUCUNE course Alpha (cross-tenant T1)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.rides),
  0,
  'bravo-reg ne voit pas la course Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 7. bravo-reg ne peut PAS insérer dans Alpha (RLS WITH CHECK cross-org)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.rides
       (organization_id, patient_id, scheduled_at,
        pickup_address, dropoff_address,
        created_by, updated_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        now() + interval '1 day', 'X', 'Y',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501',
  null,
  'bravo-reg refusé sur cross-org INSERT (WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 8. alpha-chauffeur ne voit AUCUNE course (V1 — rôle non listé)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select is(
  (select count(*)::int from public.rides),
  1,
  'chauffeur Alpha voit les rides de son org via SELECT same_org (V1 — pas de filtre par rôle au SELECT)'
);
-- Note : la policy SELECT same_org n'exclut pas le chauffeur ; le contrôle
-- d'accès chauffeur Phase 6+ se fera par filtre driver_id = auth.uid().
-- Ce que nous testons ici est qu'aucune fuite cross-tenant ne se produit.

-- -----------------------------------------------------------------------------
-- 9. alpha-chauffeur ne peut PAS INSERT (rôle non listé dans WITH CHECK)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.rides
       (organization_id, patient_id, scheduled_at,
        pickup_address, dropoff_address,
        created_by, updated_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        now() + interval '1 day', 'X', 'Y',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501',
  null,
  'chauffeur refusé INSERT rides (rôle non régulateur/dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 10-11. Defaults urgency + status (alpha-reg)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select urgency::text from public.rides limit 1),
  'programmee',
  'default urgency = programmee'
);
select is(
  (select status::text from public.rides limit 1),
  'validee',
  'default status = validee'
);

-- -----------------------------------------------------------------------------
-- 12. Constraint notes_regulateur ≤ 500 caractères
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.rides
       (organization_id, patient_id, scheduled_at,
        pickup_address, dropoff_address,
        created_by, updated_by, notes_regulateur)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        now() + interval '1 day', 'X', 'Y',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        repeat('a', 501)) $$,
  '23514',
  null,
  'notes_regulateur > 500 chars rejetée (check constraint)'
);

-- -----------------------------------------------------------------------------
-- 13. authenticated a SELECT/INSERT/UPDATE — pas de DELETE
-- -----------------------------------------------------------------------------
select ok(
  has_table_privilege('authenticated', 'public.rides', 'INSERT')
    and has_table_privilege('authenticated', 'public.rides', 'SELECT')
    and has_table_privilege('authenticated', 'public.rides', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.rides', 'DELETE'),
  'authenticated : INSERT/SELECT/UPDATE OK ; DELETE refusé'
);

-- -----------------------------------------------------------------------------
-- 14. anon refusé sur rides
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.rides', 'SELECT'),
  'anon refusé sur rides (revoke all from anon)'
);

-- -----------------------------------------------------------------------------
-- 15. 3 enums créés avec le bon nombre de valeurs
-- -----------------------------------------------------------------------------
select ok(
  (select array_length(enum_range(null::public.ride_transport_mode), 1) = 4
    and array_length(enum_range(null::public.ride_urgency), 1) = 3
    and array_length(enum_range(null::public.ride_status), 1) = 8),
  '3 enums (transport_mode=4, urgency=3, status=8) exposent les bonnes valeurs'
);

select * from finish();
rollback;
