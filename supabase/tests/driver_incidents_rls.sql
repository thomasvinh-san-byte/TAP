-- =============================================================================
-- Tests pgTAP — RLS driver_incidents (replanification dynamique, DEC-160)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée
--   - INSERT régulateur OK / chauffeur SA panne OK / chauffeur autre driver refusé
--   - SELECT same-org / cross-org strict
--   - INSERT cross-org refusé (WITH CHECK)
--   - UPDATE résolution régulateur OK
--   - DELETE refusé pour tous (historique tracé)
--   - Grants : authenticated SELECT/INSERT/UPDATE ; pas de DELETE ; anon refusé
-- =============================================================================

begin;

select plan(12);

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

-- driverA1 rattaché au profil chauffeur ; driverA2 non rattaché ; driverB1 org Bravo.
insert into public.drivers (id, organization_id, profile_id, nom_affichage, type_permis)
values
  ('f0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Chauffeur A1', '{taxi}'),
  ('f0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111',
   null, 'Chauffeur A2', '{taxi}'),
  ('f0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222',
   null, 'Chauffeur B1', '{taxi}');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.driver_incidents'::regclass),
  'RLS activée sur driver_incidents'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.driver_incidents'::regclass),
  'RLS forcée sur driver_incidents'
);

set local role authenticated;

-- 3. alpha-reg INSERT indisponibilité sur driverA2 OK
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ insert into public.driver_incidents
       (id, organization_id, driver_id, type, created_by)
     values
       ('99999999-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'f0000000-0000-0000-0000-0000000000a2', 'indisponible',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'alpha-reg INSERT indisponibilité OK'
);

-- 4. alpha-chauf INSERT SA panne (driverA1) OK
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.driver_incidents
       (organization_id, driver_id, type, nature, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'f0000000-0000-0000-0000-0000000000a1', 'panne_vehicule', 'crevaison',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-chauf INSERT sa propre panne OK'
);

-- 5. alpha-chauf INSERT panne sur driverA2 (pas le sien) refusé
select throws_ok(
  $$ insert into public.driver_incidents
       (organization_id, driver_id, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'f0000000-0000-0000-0000-0000000000a2', 'panne_vehicule',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', null,
  'alpha-chauf refusé INSERT sur un driver qui n''est pas le sien'
);

-- 6. alpha-reg SELECT same-org voit 2 incidents
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is(
  (select count(*)::int from public.driver_incidents),
  2,
  'alpha-reg voit les 2 incidents de son org'
);

-- 7. bravo-dir ne voit aucun incident Alpha (cross-tenant strict)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.driver_incidents),
  0,
  'bravo-dir ne voit aucun incident Alpha (cross-tenant strict)'
);

-- 8. bravo-dir INSERT cross-org dans Alpha refusé (WITH CHECK)
select throws_ok(
  $$ insert into public.driver_incidents
       (organization_id, driver_id, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'f0000000-0000-0000-0000-0000000000a2', 'indisponible',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- 9. alpha-reg UPDATE résolution OK
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ update public.driver_incidents
       set resolved_at = now()
       where id = '99999999-0000-0000-0000-000000000001' $$,
  'alpha-reg UPDATE résolution incident OK'
);

-- 10. DELETE refusé pour tous (historique tracé)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.driver_incidents
       where id = '99999999-0000-0000-0000-000000000001' $$,
  '42501', null,
  'DELETE incident refusé (historique tracé)'
);

-- 11-12. Grants
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.driver_incidents', 'SELECT')
    and has_table_privilege('authenticated', 'public.driver_incidents', 'INSERT')
    and has_table_privilege('authenticated', 'public.driver_incidents', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.driver_incidents', 'DELETE'),
  'Grants authenticated : SELECT/INSERT/UPDATE ; DELETE refusé'
);
select ok(
  not has_table_privilege('anon', 'public.driver_incidents', 'SELECT'),
  'anon ne peut pas lire driver_incidents'
);

select * from finish();
rollback;
