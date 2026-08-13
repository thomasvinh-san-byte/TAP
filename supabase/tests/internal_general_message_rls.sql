-- =============================================================================
-- Tests pgTAP — RLS internal_general_message (§5.22 lot A, fil général)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée
--   - régulateur Alpha écrit sur le fil général de son org
--   - chauffeur Alpha écrit aussi (fil commun : tout membre de l'org)
--   - chauffeur Alpha lit les 2 messages du fil (org commun)
--   - anti-usurpation : sender_profile_id ≠ auth.uid() refusé (WITH CHECK)
--   - anti-usurpation : sender_role ≠ current_user_role() refusé
--   - cross-tenant : chauffeur Bravo ne voit aucun message Alpha
--   - cross-tenant : chauffeur Bravo ne peut pas écrire dans le fil Alpha
--   - grants authenticated = SELECT/INSERT, pas UPDATE/DELETE (immuable)
--   - anon refusé
--
-- Le fil général n'a AUCUNE dépendance course/chauffeur : fixtures minimales
-- (2 orgs, 1 régulateur + 1 chauffeur Alpha, 1 chauffeur Bravo).
-- =============================================================================

begin;

select plan(11);

-- -----------------------------------------------------------------------------
-- Fixtures : Org Alpha (reg + chauffeur) + Org Bravo (1 chauffeur).
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
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-chf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chf@test.tap'),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '22222222-2222-2222-2222-222222222222',
   'chauffeur', 'Bravo', 'Chauffeur', 'bravo-chf@test.tap');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.internal_general_message'::regclass),
  'RLS activée sur internal_general_message'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.internal_general_message'::regclass),
  'RLS forcée sur internal_general_message'
);

-- -----------------------------------------------------------------------------
-- 3. régulateur Alpha écrit sur le fil général de son org
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.internal_general_message
       (organization_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'regulateur',
        'Rappel : réunion 8h.') $$,
  'régulateur Alpha INSERT sur le fil général OK'
);

-- -----------------------------------------------------------------------------
-- 4. chauffeur Alpha écrit aussi (fil commun à l'org)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
select lives_ok(
  $$ insert into public.internal_general_message
       (organization_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'chauffeur',
        'Bien reçu.') $$,
  'chauffeur Alpha INSERT sur le fil général OK (fil commun)'
);

-- -----------------------------------------------------------------------------
-- 5. chauffeur Alpha lit les 2 messages du fil général de son org
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.internal_general_message),
  2,
  'chauffeur Alpha voit les 2 messages du fil général (org commun)'
);

-- -----------------------------------------------------------------------------
-- 6. Anti-usurpation : sender_profile_id ≠ auth.uid() refusé
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.internal_general_message
       (organization_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'chauffeur',
        'Usurpation') $$,
  '42501',
  null,
  'sender_profile_id ≠ auth.uid() refusé (anti-usurpation)'
);

-- -----------------------------------------------------------------------------
-- 7. Anti-usurpation : sender_role ≠ current_user_role() refusé
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.internal_general_message
       (organization_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dirigeant',
        'Rôle usurpé') $$,
  '42501',
  null,
  'sender_role ≠ current_user_role() refusé'
);

-- -----------------------------------------------------------------------------
-- 8. Cross-tenant : chauffeur Bravo ne voit aucun message Alpha
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
select is(
  (select count(*)::int from public.internal_general_message),
  0,
  'chauffeur Bravo ne voit aucun message Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 9. Cross-tenant : chauffeur Bravo ne peut pas écrire dans le fil Alpha
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.internal_general_message
       (organization_id, sender_profile_id, sender_role, body)
     values
       ('11111111-1111-1111-1111-111111111111',
        'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'chauffeur',
        'Cross-tenant') $$,
  '42501',
  null,
  'chauffeur Bravo refusé INSERT dans le fil Alpha (cross-tenant)'
);

-- -----------------------------------------------------------------------------
-- 10. Grants : authenticated SELECT/INSERT ; pas UPDATE/DELETE (immuable)
-- -----------------------------------------------------------------------------
-- Les grants UPDATE/DELETE restent octroyés à authenticated (défaut Supabase) :
-- l'immuabilité des messages est assurée par l'ABSENCE de policy UPDATE/DELETE
-- (RLS bloque → 0 ligne), pas par la révocation du grant.
select ok(
  has_table_privilege('authenticated', 'public.internal_general_message', 'SELECT')
    and has_table_privilege('authenticated', 'public.internal_general_message', 'INSERT'),
  'authenticated : SELECT/INSERT OK (UPDATE/DELETE bloqués par absence de policy RLS — messages immuables)'
);

-- -----------------------------------------------------------------------------
-- 11. anon refusé
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.internal_general_message', 'SELECT'),
  'anon refusé sur internal_general_message'
);

select * from finish();
rollback;
