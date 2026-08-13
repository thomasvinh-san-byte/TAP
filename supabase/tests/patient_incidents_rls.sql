-- =============================================================================
-- Tests pgTAP — Historique des incidents patient (patient_incidents, PATIENT-01)
-- =============================================================================
-- Couverture (CdG §5.2) :
--   - RLS activée + forcée
--   - INSERT régulateur autorisé / chauffeur refusé
--   - Isolation tenant (lecture same-org)
--   - CASCADE delete depuis patients
--   - audit_logs : insert tracé
-- Journal immuable : aucune policy UPDATE/DELETE (non testé car inexistant).
-- =============================================================================

begin;

select plan(7);

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
  ('e0e00005-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'regulateur', 'Bravo', 'Régulateur', 'bravo-reg@test.tap'),
  ('e0e00005-e0e0-e0e0-e0e0-e0e0e0e0e0e0', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chf@test.tap');

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
  (select relrowsecurity from pg_class where oid = 'public.patient_incidents'::regclass),
  'RLS activée sur patient_incidents'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.patient_incidents'::regclass),
  'RLS forcée sur patient_incidents'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-reg insère un incident
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ insert into public.patient_incidents
       (organization_id, patient_id, type, note, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'retard', 'Patient en retard de 20 min',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg insère un incident retard'
);

-- -----------------------------------------------------------------------------
-- 4. bravo-reg ne voit pas l'incident cross-tenant
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select is(
  (select count(*)::int from public.patient_incidents
     where patient_id = '99999999-9999-9999-9999-999999999991'),
  0,
  'bravo-reg ne voit pas les incidents Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 5. Chauffeur ne peut pas INSERT (rôle non autorisé)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e0e00005-e0e0-e0e0-e0e0-e0e0e0e0e0e0';

select throws_ok(
  $$ insert into public.patient_incidents
       (organization_id, patient_id, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'plainte',
        'e0e00005-e0e0-e0e0-e0e0-e0e0e0e0e0e0') $$,
  '42501',
  null,
  'Chauffeur ne peut pas INSERT patient_incidents (rôle régulateur/dirigeant requis)'
);

-- -----------------------------------------------------------------------------
-- 6. CASCADE delete depuis patients (en service_role)
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

delete from public.patients where id = '99999999-9999-9999-9999-999999999991';

select is(
  (select count(*)::int from public.patient_incidents
     where patient_id = '99999999-9999-9999-9999-999999999991'),
  0,
  'CASCADE delete depuis patients supprime les patient_incidents liés'
);

-- -----------------------------------------------------------------------------
-- 7. Audit log : insert tracé
-- -----------------------------------------------------------------------------
select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'patient_incident.insert'
   )),
  'audit_logs reçoit patient_incident.insert après l''INSERT'
);

select * from finish();
rollback;
