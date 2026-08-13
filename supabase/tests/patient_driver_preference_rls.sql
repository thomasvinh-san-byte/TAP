-- =============================================================================
-- Tests pgTAP — Préférences chauffeur du patient (patient_driver_preference)
-- =============================================================================
-- Couverture (CdG §5.2, PATIENT-02) :
--   - RLS activée + forcée
--   - INSERT régulateur autorisé / chauffeur refusé
--   - Exclusion mutuelle préféré/évité (unique (patient_id, driver_id))
--   - Isolation tenant (lecture same-org)
--   - DELETE régulateur autorisé
--   - audit_logs : insert tracé
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures (2 orgs + régulateur Alpha + régulateur Bravo + chauffeur Alpha)
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('e0e00004-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'regulateur', 'Bravo', 'Régulateur', 'bravo-reg@test.tap'),
  ('e0e00004-e0e0-e0e0-e0e0-e0e0e0e0e0e0', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chf@test.tap');

insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111', 'Hoarau', 'Patrick',
   '1980-01-23', '12 rue Pasteur', '97400', 'Saint-Denis', 'appel');

insert into public.drivers (id, organization_id, nom_affichage, created_by)
values
  ('ffffffff-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Vergoz Jean',
   'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class
     where oid = 'public.patient_driver_preference'::regclass),
  'RLS activée sur patient_driver_preference'
);
select ok(
  (select relforcerowsecurity from pg_class
     where oid = 'public.patient_driver_preference'::regclass),
  'RLS forcée sur patient_driver_preference'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-reg ajoute un chauffeur préféré
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'prefere',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg ajoute un chauffeur préféré'
);

-- -----------------------------------------------------------------------------
-- 4. Exclusion mutuelle : même (patient, chauffeur) en évité → unique violation
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'evite',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '23505',
  null,
  'Exclusion mutuelle : un chauffeur ne peut être préféré ET évité (unique)'
);

-- -----------------------------------------------------------------------------
-- 5. bravo-reg ne voit pas la préférence cross-tenant
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select is(
  (select count(*)::int from public.patient_driver_preference
     where patient_id = '99999999-9999-9999-9999-999999999991'),
  0,
  'bravo-reg ne voit pas les préférences Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 6. Chauffeur ne peut pas INSERT (rôle non autorisé)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e0e00004-e0e0-e0e0-e0e0-e0e0e0e0e0e0';

select throws_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'evite',
        'e0e00004-e0e0-e0e0-e0e0-e0e0e0e0e0e0') $$,
  '42501',
  null,
  'Chauffeur ne peut pas INSERT patient_driver_preference'
);

-- -----------------------------------------------------------------------------
-- 7. alpha-reg peut DELETE sa préférence (retrait)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ delete from public.patient_driver_preference
       where patient_id = '99999999-9999-9999-9999-999999999991'
         and driver_id = 'ffffffff-0000-0000-0000-000000000001' $$,
  'alpha-reg retire la préférence (DELETE autorisé)'
);

-- -----------------------------------------------------------------------------
-- 8. Audit log : insert tracé
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'patient_driver_preference.insert'
   )),
  'audit_logs reçoit patient_driver_preference.insert après l''INSERT'
);

select * from finish();
rollback;
