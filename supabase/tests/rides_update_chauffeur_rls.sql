-- =============================================================================
-- Tests pgTAP — RLS rides_update_chauffeur_own_rides (Phase 04.5 T1.4)
-- =============================================================================
-- Couverture :
--   - Chauffeur Alpha 1 peut UPDATE ride assignée à son driver_id (status,
--     started_at) — policy USING permet l'accès.
--   - Chauffeur Alpha 1 NE peut PAS UPDATE ride assignée à un autre chauffeur
--     même org (driver_id_2) — RLS rejette silencieusement (0 rows).
--   - Chauffeur Alpha 1 NE peut PAS transférer SA ride vers driver_id_2
--     via UPDATE driver_id — WITH CHECK rejette (42501).
--   - Régulateur Alpha conserve UPDATE (régression rides_update_regulateur).
--   - Cross-tenant : chauffeur Bravo ne peut UPDATE aucune ride Alpha.
--
-- Pattern dupliqué de supabase/tests/rides_rls.sql.
-- =============================================================================

begin;

select plan(7);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant : Org Alpha (dir + reg + 2 chauffeurs) + Org Bravo
-- (1 chauffeur). 2 rides Alpha (1 par chauffeur).
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
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chf1@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chf2@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-chf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur1', 'alpha-chf1@test.tap'),
  ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur2', 'alpha-chf2@test.tap'),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '22222222-2222-2222-2222-222222222222',
   'chauffeur', 'Bravo', 'Chauffeur', 'bravo-chf@test.tap');

insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'Hoarau', 'Patrick', '1980-01-23', '12 rue Pasteur',
   '97400', 'Saint-Denis', 'appel');

-- Drivers (insérés sous dirigeant Alpha — policy drivers_insert_dirigeant)
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.drivers
  (id, organization_id, profile_id, nom_affichage, telephone, type_permis, created_by)
values
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   '11111111-1111-1111-1111-111111111111',
   'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
   'Chauffeur1 Alpha', '0692000001', '{taxi}',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
   '11111111-1111-1111-1111-111111111111',
   'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
   'Chauffeur2 Alpha', '0692000002', '{taxi}',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- 2 rides Alpha, statut assignee, une par chauffeur (insérées sous régulateur)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

insert into public.rides
  (id, organization_id, patient_id, scheduled_at,
   pickup_address, dropoff_address, status, driver_id,
   created_by, updated_by)
values
  ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   now() + interval '1 hour',
   '12 rue Pasteur', 'CHU Bellepierre', 'assignee',
   'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   now() + interval '2 hours',
   '12 rue Pasteur', 'CHU Bellepierre', 'assignee',
   'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- -----------------------------------------------------------------------------
-- 1. Chauffeur1 Alpha peut UPDATE ride1 (sa propre course)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';

with upd as (
  update public.rides
     set status = 'en_cours', started_at = now()
   where id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
  returning id
)
select is(
  (select count(*)::int from upd),
  1,
  'chauffeur1 UPDATE sa propre ride OK (RLS USING permet)'
);

-- -----------------------------------------------------------------------------
-- 2. Chauffeur1 ne peut PAS UPDATE ride2 (assignée à chauffeur2)
-- -----------------------------------------------------------------------------
with upd as (
  update public.rides
     set status = 'en_cours', started_at = now()
   where id = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa'
  returning id
)
select is(
  (select count(*)::int from upd),
  0,
  'chauffeur1 UPDATE ride2 rejeté silencieusement par RLS (0 rows)'
);

-- -----------------------------------------------------------------------------
-- 3. ride2 n'a effectivement PAS été modifiée (statut toujours assignee)
-- -----------------------------------------------------------------------------
select is(
  (select status::text from public.rides
   where id = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa'),
  'assignee',
  'ride2 inchangée (statut assignee maintenu)'
);

-- -----------------------------------------------------------------------------
-- 4. Chauffeur1 ne peut PAS transférer SA ride vers driver_id_2 (WITH CHECK)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.rides
        set driver_id = 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2'
      where id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa' $$,
  '42501',
  null,
  'chauffeur1 refusé pour transfert ride vers driver_id_2 (WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 5. Chauffeur Bravo (autre org) ne voit même pas ride1 Alpha (cross-tenant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';

with upd as (
  update public.rides
     set status = 'en_cours'
   where id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
  returning id
)
select is(
  (select count(*)::int from upd),
  0,
  'chauffeur Bravo UPDATE ride Alpha rejeté (cross-tenant + cross-driver)'
);

-- -----------------------------------------------------------------------------
-- 6. Régression — régulateur Alpha conserve son UPDATE (policy intacte)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

with upd as (
  update public.rides
     set notes_regulateur = 'Note test régression'
   where id = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa'
  returning id
)
select is(
  (select count(*)::int from upd),
  1,
  'régulateur Alpha UPDATE rides OK (régression rides_update_regulateur_dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 7. La policy rides_update_chauffeur_own_rides existe bien
-- -----------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'rides'
       and policyname = 'rides_update_chauffeur_own_rides'
  ),
  'policy rides_update_chauffeur_own_rides créée'
);

select * from finish();
rollback;
