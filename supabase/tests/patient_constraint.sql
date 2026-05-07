-- =============================================================================
-- Tests pgTAP — Contraintes patient (Phase 1, Plan 1, Wave 0 RED)
-- =============================================================================
-- État RED attendu en Wave 0 : table public.patient_constraint absente.
-- Wave 1 (migration 003) rendra ces tests verts.
--
-- Couverture (PAT-05, PAT-07) :
--   - RLS activée + forcée
--   - INSERT régulateur autorisé / chauffeur refusé
--   - Isolation tenant
--   - CASCADE delete depuis patients
--   - audit_logs : insert + delete tracés
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures (orgs + 3 users + 1 chauffeur Alpha)
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

-- Patient parent en Alpha (créé en service_role pour bypasser RLS d'init)
insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111', 'Hoarau', 'Patrick',
   '1980-01-23', '12 rue Pasteur', '97400', 'Saint-Denis', 'appel');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.patient_constraint'::regclass),
  'RLS activée sur patient_constraint'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.patient_constraint'::regclass),
  'RLS forcée sur patient_constraint'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-reg insère une contrainte vehicule_tpmr
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ insert into public.patient_constraint
       (organization_id, patient_id, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'vehicule_tpmr',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg insère une contrainte vehicule_tpmr'
);

-- -----------------------------------------------------------------------------
-- 4. bravo-reg ne voit pas la contrainte cross-tenant
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select is(
  (select count(*)::int from public.patient_constraint
     where patient_id = '99999999-9999-9999-9999-999999999991'),
  0,
  'bravo-reg ne voit pas les contraintes Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 5. CASCADE delete depuis patients (en service_role)
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

delete from public.patients where id = '99999999-9999-9999-9999-999999999991';

select is(
  (select count(*)::int from public.patient_constraint
     where patient_id = '99999999-9999-9999-9999-999999999991'),
  0,
  'CASCADE delete depuis patients supprime les patient_constraint liées'
);

-- -----------------------------------------------------------------------------
-- 6. Chauffeur ne peut pas INSERT (rôle non autorisé)
-- -----------------------------------------------------------------------------
-- Recréer un patient pour le test (en service_role)
insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999992',
   '11111111-1111-1111-1111-111111111111', 'Payet', 'Marie',
   '1975-06-15', '8 rue Léon Dierx', '97400', 'Saint-Denis', 'sms');

set local role authenticated;
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

select throws_ok(
  $$ insert into public.patient_constraint
       (organization_id, patient_id, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999992',
        'medical_oxygene',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  '42501',
  null,
  'Chauffeur ne peut pas INSERT patient_constraint (rôle régulateur/dirigeant requis)'
);

-- -----------------------------------------------------------------------------
-- 7-8. Audit logs : insert + delete
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'patient_constraint.insert'
   )),
  'audit_logs reçoit patient_constraint.insert après l''INSERT'
);

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'patient_constraint.delete'
   )),
  'audit_logs reçoit patient_constraint.delete après le CASCADE'
);

select * from finish();
rollback;
