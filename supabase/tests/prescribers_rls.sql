-- =============================================================================
-- Tests pgTAP — RLS prescribers (référentiel prescripteurs, DEC-162)
-- =============================================================================
-- Couverture (calquée sur ordering_parties + driver_incidents) :
--   - RLS activée + forcée
--   - INSERT dirigeant OK / régulateur OK / chauffeur refusé
--   - SELECT same-org / cross-org strict
--   - INSERT cross-org refusé (WITH CHECK)
--   - UPDATE régulateur same-org OK
--   - DELETE refusé pour tous (archivage logique)
--   - Grants : authenticated SELECT/INSERT/UPDATE ; pas de DELETE ; anon refusé
-- =============================================================================

begin;

select plan(11);

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

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.prescribers'::regclass),
  'RLS activée sur prescribers'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.prescribers'::regclass),
  'RLS forcée sur prescribers'
);

set local role authenticated;

-- 3. alpha-dir INSERT médecin OK
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.prescribers
       (id, organization_id, nom, prenom, type, rpps, created_by)
     values
       ('99999999-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'Hoarau', 'Jean', 'medecin', '10000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT prescripteur médecin OK'
);

-- 4. alpha-reg INSERT établissement OK (régulateur autorisé)
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ insert into public.prescribers
       (organization_id, nom, type, finess, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'CHU Felix Guyon', 'etablissement', '970000001',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'alpha-reg INSERT prescripteur établissement OK'
);

-- 5. alpha-chauf INSERT refusé (rôle non autorisé)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.prescribers
       (organization_id, nom, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'X', 'medecin',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', null,
  'alpha-chauf refusé INSERT prescripteur (rôle non autorisé)'
);

-- 6. alpha-reg SELECT same-org voit 2
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is(
  (select count(*)::int from public.prescribers),
  2,
  'alpha-reg voit les 2 prescripteurs de son org'
);

-- 7. bravo-dir ne voit aucun prescripteur Alpha (cross-tenant)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.prescribers),
  0,
  'bravo-dir ne voit aucun prescripteur Alpha (cross-tenant strict)'
);

-- 8. bravo-dir INSERT cross-org dans Alpha refusé (WITH CHECK)
select throws_ok(
  $$ insert into public.prescribers
       (organization_id, nom, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Y', 'medecin',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- 9. alpha-reg UPDATE same-org OK
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ update public.prescribers
       set specialite = 'Néphrologie'
       where id = '99999999-0000-0000-0000-000000000001' $$,
  'alpha-reg UPDATE prescripteur same-org OK'
);

-- 10. DELETE refusé par RLS (archivage logique — aucune policy DELETE).
-- authenticated a le grant DELETE (défaut Supabase) mais aucune policy DELETE ne
-- rend de ligne supprimable → 0 ligne supprimée, sans erreur.
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with del as (
  delete from public.prescribers
    where id = '99999999-0000-0000-0000-000000000001'
    returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'DELETE prescripteur bloqué par RLS (0 ligne supprimée ; archivage logique)'
);

-- 11. Grants : authenticated SELECT/INSERT/UPDATE ; anon révoqué. Le grant DELETE
-- reste octroyé (défaut Supabase) : la protection est l'absence de policy DELETE.
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.prescribers', 'SELECT')
    and has_table_privilege('authenticated', 'public.prescribers', 'INSERT')
    and has_table_privilege('authenticated', 'public.prescribers', 'UPDATE')
    and not has_table_privilege('anon', 'public.prescribers', 'SELECT'),
  'Grants : authenticated SELECT/INSERT/UPDATE ; anon révoqué (DELETE contrôlé par RLS)'
);

select * from finish();
rollback;
