-- =============================================================================
-- Tests pgTAP — Origine des préférences (chauffeur → patient) — CHAUFFEUR-03
-- =============================================================================
-- Couverture (§5.6) :
--   - colonne origin présente
--   - direction chauffeur insérée par le régulateur (origin='chauffeur')
--   - les DEUX directions coexistent sur un même couple (patient, chauffeur)
--   - unicité par direction : doublon même (patient, driver, origin) refusé
--   - chauffeur (rôle) ne peut pas insérer
--   - isolation tenant (lecture same-org)
--   - audit tracé
-- =============================================================================

begin;

select plan(8);

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
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'regulateur', 'Bravo', 'Régulateur', 'bravo-reg@test.tap'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
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
-- 1. Colonne origin présente
-- -----------------------------------------------------------------------------
select has_column(
  'public', 'patient_driver_preference', 'origin',
  'patient_driver_preference.origin existe'
);

set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- -----------------------------------------------------------------------------
-- 2. Régulateur insère la direction chauffeur → patient
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, origin, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'prefere', 'chauffeur',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'régulateur insère une préférence origin=chauffeur'
);

-- -----------------------------------------------------------------------------
-- 3. Les deux directions coexistent sur le même couple (patient, chauffeur)
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, origin, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'evite', 'patient',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'la direction patient coexiste avec la direction chauffeur (même couple)'
);

-- -----------------------------------------------------------------------------
-- 4. Doublon même direction refusé (unicité patient, driver, origin)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, origin, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'evite', 'chauffeur',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '23505',
  null,
  'doublon même direction refusé (unicité patient, driver, origin)'
);

-- -----------------------------------------------------------------------------
-- 5. bravo-reg ne voit pas les préférences Alpha (isolation tenant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.patient_driver_preference
     where patient_id = '99999999-9999-9999-9999-999999999991'),
  0,
  'bravo-reg ne voit pas les préférences Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 6. Chauffeur (rôle) ne peut pas insérer
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select throws_ok(
  $$ insert into public.patient_driver_preference
       (organization_id, patient_id, driver_id, kind, origin, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'ffffffff-0000-0000-0000-000000000001', 'prefere', 'chauffeur',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  '42501',
  null,
  'chauffeur ne peut pas insérer de préférence'
);

-- -----------------------------------------------------------------------------
-- 7. Régulateur retire une préférence (DELETE)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ delete from public.patient_driver_preference
       where patient_id = '99999999-9999-9999-9999-999999999991'
         and driver_id = 'ffffffff-0000-0000-0000-000000000001'
         and origin = 'chauffeur' $$,
  'régulateur retire la préférence origin=chauffeur (DELETE)'
);

-- -----------------------------------------------------------------------------
-- 8. Audit tracé
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'patient_driver_preference.insert'
   )),
  'audit_logs reçoit patient_driver_preference.insert'
);

select * from finish();
rollback;
