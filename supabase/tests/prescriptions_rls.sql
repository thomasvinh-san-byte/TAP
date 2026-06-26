-- =============================================================================
-- Tests pgTAP — prescriptions : RLS + compteur de trajets (DEC-163)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée
--   - INSERT dirigeant OK / régulateur OK / chauffeur refusé
--   - SELECT same-org / cross-org strict ; INSERT cross-org refusé
--   - DELETE refusé ; grants
--   - Trigger compteur idempotent : +1 par course consommatrice, statut
--     epuisee, décrément à l'annulation, retour active, pas de double-compte
-- =============================================================================

begin;

select plan(16);

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
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chauf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chauf@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap');

-- Patients (FK requise) — 1 par org.
insert into public.patients (id, organization_id, prenom, nom, date_naissance,
  adresse_ligne1, code_postal, ville)
values
  ('70000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111',
   'Marie', 'Hoarau', '1950-01-01', '1 rue A', '97400', 'Saint-Denis'),
  ('70000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222',
   'Paul', 'Payet', '1960-01-01', '2 rue B', '97410', 'Saint-Pierre');

-- 1. RLS forcée
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.prescriptions'::regclass),
  'RLS forcée sur prescriptions'
);

set local role authenticated;

-- 2. alpha-dir INSERT OK
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.prescriptions
       (id, organization_id, patient_id, numero, date_prescription, trajets_autorises, created_by)
     values ('99999999-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-0000000000a1',
       'BT-1', '2026-06-01', 5, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT prescription OK'
);

-- 3. alpha-reg INSERT OK
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ insert into public.prescriptions
       (organization_id, patient_id, numero, date_prescription, trajets_autorises, created_by)
     values ('11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-0000000000a1',
       'BT-2', '2026-06-02', 3, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'alpha-reg INSERT prescription OK'
);

-- 4. alpha-chauf INSERT refusé
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.prescriptions
       (organization_id, patient_id, numero, date_prescription, trajets_autorises, created_by)
     values ('11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-0000000000a1',
       'BT-X', '2026-06-03', 2, 'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', null, 'alpha-chauf refusé INSERT prescription'
);

-- 5. alpha-reg SELECT same-org = 2
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is((select count(*)::int from public.prescriptions), 2,
  'alpha-reg voit les 2 prescriptions de son org');

-- 6. bravo-dir cross-org = 0
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is((select count(*)::int from public.prescriptions), 0,
  'bravo-dir ne voit aucune prescription Alpha (cross-tenant)');

-- 7. bravo-dir INSERT cross-org refusé
select throws_ok(
  $$ insert into public.prescriptions
       (organization_id, patient_id, numero, date_prescription, trajets_autorises, created_by)
     values ('11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-0000000000a1',
       'BT-Y', '2026-06-04', 2, 'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null, 'bravo-dir refusé INSERT cross-org (WITH CHECK)');

-- 8. DELETE refusé
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.prescriptions where id = '99999999-0000-0000-0000-000000000001' $$,
  '42501', null, 'DELETE prescription refusé');

-- 9. Grants
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.prescriptions', 'SELECT')
    and has_table_privilege('authenticated', 'public.prescriptions', 'INSERT')
    and has_table_privilege('authenticated', 'public.prescriptions', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.prescriptions', 'DELETE')
    and not has_table_privilege('anon', 'public.prescriptions', 'SELECT'),
  'Grants : authenticated SELECT/INSERT/UPDATE ; DELETE refusé ; anon refusé');

-- =========================================================================
-- Compteur de trajets (exécuté en owner : la RLS ne s'applique pas, mais le
-- TRIGGER fire quel que soit le rôle — c'est lui qu'on teste).
-- =========================================================================
-- BT-1 : 5 trajets autorisés, 0 consommés.

-- R1 validee → +1
insert into public.rides (id, organization_id, patient_id, scheduled_at, pickup_address,
  dropoff_address, status, prescription_id, created_by, updated_by)
values ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  '70000000-0000-0000-0000-0000000000a1', now(), 'A', 'B', 'validee',
  '99999999-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select is((select trajets_consommes from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 1,
  'Compteur +1 après 1re course consommatrice');

-- Consommer jusqu'à épuisement : on passe trajets_autorises à 1 pour tester
-- vite l'épuisement (puis on remet). Plus simple : on ajoute 4 courses.
insert into public.rides (organization_id, patient_id, scheduled_at, pickup_address,
  dropoff_address, status, prescription_id, created_by, updated_by)
select '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-0000000000a1',
  now(), 'A', 'B', 'validee', '99999999-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
from generate_series(1, 4);
select is((select statut::text from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 'epuisee',
  'Statut epuisee à 5/5');

-- Annuler R1 → -1 → 4/5 → active
update public.rides set status = 'annulee_regulateur'
  where id = '60000000-0000-0000-0000-000000000001';
select is((select trajets_consommes from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 4,
  'Compteur -1 après annulation');
select is((select statut::text from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 'active',
  'Statut active après libération d''un trajet');

-- Idempotence : ré-écrire le même statut annulé ne re-décrémente pas.
update public.rides set status = 'annulee_regulateur', updated_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  where id = '60000000-0000-0000-0000-000000000001';
select is((select trajets_consommes from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 4,
  'Idempotent : ré-écrire le même statut ne change pas le compteur');

-- DEC-174 : une annulation MÉTÉO rend aussi le trajet (statut annulee_meteo
-- inclus dans l'array `cancelled`). R2 consommatrice puis annulée météo.
insert into public.rides (id, organization_id, patient_id, scheduled_at, pickup_address,
  dropoff_address, status, prescription_id, created_by, updated_by)
values ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
  '70000000-0000-0000-0000-0000000000a1', now(), 'A', 'B', 'validee',
  '99999999-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select is((select trajets_consommes from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 5,
  'Compteur +1 après une nouvelle course consommatrice (avant annulation météo)');

update public.rides set status = 'annulee_meteo'
  where id = '60000000-0000-0000-0000-000000000002';
select is((select trajets_consommes from public.prescriptions
  where id = '99999999-0000-0000-0000-000000000001'), 4,
  'annulee_meteo rend le trajet au patient (DEC-174 : -1 a l''annulation meteo)');

select * from finish();
rollback;
