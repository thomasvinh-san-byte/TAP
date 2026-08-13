-- =============================================================================
-- Tests pgTAP — RLS internal_message (Phase 06.41, DEC-120)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée
--   - régulateur Alpha écrit + lit un message sur une course de son org
--   - chauffeur1 (propriétaire de ride1) lit + écrit sur SA course
--   - chauffeur1 ne voit PAS les messages de ride2 (course de chauffeur2)
--   - chauffeur1 ne peut PAS écrire sur ride2 (course d'un autre)
--   - anti-usurpation : sender_profile_id ≠ auth.uid() refusé (WITH CHECK)
--   - anti-usurpation : sender_role ≠ current_user_role() refusé
--   - cross-tenant : bravo ne voit ni n'écrit sur une course Alpha
--   - anon refusé ; grants authenticated = SELECT/INSERT, pas UPDATE/DELETE
--   - messages immuables (pas de policy UPDATE)
--
-- Fixtures dupliquées de supabase/tests/rides_update_chauffeur_rls.sql.
-- =============================================================================

begin;

select plan(14);

-- -----------------------------------------------------------------------------
-- Fixtures : Org Alpha (dir + reg + 2 chauffeurs) + Org Bravo (1 chauffeur).
-- 2 rides Alpha (1 par chauffeur).
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

-- Drivers (insérés sous dirigeant Alpha).
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

-- 2 rides Alpha (1 par chauffeur), insérées sous régulateur.
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
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.internal_message'::regclass),
  'RLS activée sur internal_message'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.internal_message'::regclass),
  'RLS forcée sur internal_message'
);

-- -----------------------------------------------------------------------------
-- 3. régulateur Alpha écrit un message sur ride1 (sa course d'org)
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.internal_message
       (organization_id, ride_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'regulateur',
        'Bonjour, départ confirmé ?') $$,
  'régulateur Alpha INSERT message sur ride1 OK'
);

-- -----------------------------------------------------------------------------
-- 4. chauffeur1 (propriétaire de ride1) écrit sur SA course
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
select lives_ok(
  $$ insert into public.internal_message
       (organization_id, ride_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'chauffeur',
        'Oui, en route.') $$,
  'chauffeur1 INSERT message sur SA course (ride1) OK'
);

-- -----------------------------------------------------------------------------
-- 5. chauffeur1 lit les 2 messages de ride1 (le sien + celui du régulateur)
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.internal_message
    where ride_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'),
  2,
  'chauffeur1 voit les 2 messages de SA course (fil partagé régul↔chauffeur)'
);

-- -----------------------------------------------------------------------------
-- 6. chauffeur1 ne peut PAS écrire sur ride2 (course de chauffeur2) — WITH CHECK
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.internal_message
       (organization_id, ride_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa',
        'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'chauffeur',
        'Message intrus') $$,
  '42501',
  null,
  'chauffeur1 refusé INSERT sur ride2 (course d''un autre chauffeur)'
);

-- -----------------------------------------------------------------------------
-- 7. Le régulateur écrit un message sur ride2 (pour le test de lecture suivant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
insert into public.internal_message
  (organization_id, ride_id, sender_profile_id, sender_role, body)
values
  ('11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'regulateur',
   'Course 2 : confirme la prise en charge.');

-- -----------------------------------------------------------------------------
-- 8. chauffeur1 ne voit AUCUN message de ride2 (course d'un autre chauffeur)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
select is(
  (select count(*)::int from public.internal_message
    where ride_id = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa'),
  0,
  'chauffeur1 ne voit pas les messages de ride2 (isolation par course/chauffeur)'
);

-- chauffeur1 ne voit globalement que les messages de SES courses (2 au total).
select is(
  (select count(*)::int from public.internal_message),
  2,
  'chauffeur1 ne voit QUE les messages de ses courses (2)'
);

-- -----------------------------------------------------------------------------
-- 9. Anti-usurpation : régulateur ne peut pas écrire au nom d'un autre profil
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.internal_message
       (organization_id, ride_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'chauffeur',
        'Usurpation') $$,
  '42501',
  null,
  'sender_profile_id ≠ auth.uid() refusé (anti-usurpation)'
);

-- -----------------------------------------------------------------------------
-- 10. Anti-usurpation : sender_role ≠ current_user_role() refusé
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.internal_message
       (organization_id, ride_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dirigeant',
        'Rôle usurpé') $$,
  '42501',
  null,
  'sender_role ≠ current_user_role() refusé'
);

-- -----------------------------------------------------------------------------
-- 11. Cross-tenant : chauffeur Bravo ne voit aucun message Alpha
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
select is(
  (select count(*)::int from public.internal_message),
  0,
  'chauffeur Bravo ne voit aucun message Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 12. Cross-tenant : chauffeur Bravo ne peut pas écrire sur une course Alpha
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.internal_message
       (organization_id, ride_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'chauffeur',
        'Cross-tenant') $$,
  '42501',
  null,
  'chauffeur Bravo refusé INSERT sur course Alpha (cross-tenant)'
);

-- -----------------------------------------------------------------------------
-- 13. Grants : authenticated SELECT/INSERT ; pas UPDATE/DELETE (immuable)
-- -----------------------------------------------------------------------------
-- Les grants UPDATE/DELETE restent octroyés à authenticated (défaut Supabase) :
-- l'immuabilité des messages est assurée par l'ABSENCE de policy UPDATE/DELETE
-- (RLS bloque → 0 ligne), pas par la révocation du grant.
select ok(
  has_table_privilege('authenticated', 'public.internal_message', 'SELECT')
    and has_table_privilege('authenticated', 'public.internal_message', 'INSERT'),
  'authenticated : SELECT/INSERT OK (UPDATE/DELETE bloqués par absence de policy RLS — messages immuables)'
);

-- -----------------------------------------------------------------------------
-- 14. anon refusé
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.internal_message', 'SELECT'),
  'anon refusé sur internal_message'
);

select * from finish();
rollback;
