-- =============================================================================
-- Tests pgTAP — RLS drivers (Phase 3, Passe 1, sous-bloc 03-A)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée sur public.drivers
--   - SELECT same-org / cross-org strict (cross-tenant)
--   - INSERT dirigeant OK / régulateur refusé / chauffeur refusé
--   - UPDATE dirigeant OK / régulateur refusé
--   - DELETE refusé pour tous (pas de policy DELETE)
--   - profile_id NULL accepté (chauffeur enregistré sans compte Auth)
--   - Audit log écrit sur INSERT (action driver.insert)
--   - Audit log écrit sur UPDATE (action driver.update)
--   - Grants authenticated (SELECT/INSERT/UPDATE) ; anon refusé
--
-- Pattern dupliqué de supabase/tests/rides_rls.sql.
-- =============================================================================

begin;

select plan(13);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant : Org Alpha + Org Bravo + 4 users (3 rôles Alpha + reg Bravo)
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
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chauffeur@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chauffeur@test.tap');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.drivers'::regclass),
  'RLS activée sur drivers'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.drivers'::regclass),
  'RLS forcée sur drivers (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-dir INSERT (dirigeant autorisé) — profile_id NULL accepté
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.drivers
       (id, organization_id, profile_id, nom_affichage, telephone, type_permis, created_by)
     values
       ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        null,
        'Vergoz Jean', '0692111111', '{taxi}'::text[],
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT driver OK (profile_id NULL accepté)'
);

-- -----------------------------------------------------------------------------
-- 4. alpha-reg INSERT refusé (régulateur n'est pas dirigeant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.drivers
       (organization_id, nom_affichage, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'Maillot André',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'alpha-reg refusé INSERT driver (rôle non dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 5. alpha-chauffeur INSERT refusé
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ insert into public.drivers
       (organization_id, nom_affichage, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'Boyer Sophie',
        'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501',
  null,
  'alpha-chauffeur refusé INSERT driver (rôle non dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 6. alpha-reg SELECT voit les chauffeurs same-org
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select count(*)::int from public.drivers),
  1,
  'alpha-reg voit le driver Alpha via SELECT same_org'
);

-- -----------------------------------------------------------------------------
-- 7. bravo-dir ne voit pas les chauffeurs Alpha (cross-tenant strict)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.drivers),
  0,
  'bravo-dir ne voit aucun driver Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 8. bravo-dir refusé INSERT cross-org dans Alpha (WITH CHECK)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.drivers
       (organization_id, nom_affichage, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'Intrusion Bravo',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501',
  null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- -----------------------------------------------------------------------------
-- 9. alpha-dir UPDATE OK
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ update public.drivers
       set actif = false
       where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'alpha-dir UPDATE driver OK'
);

-- -----------------------------------------------------------------------------
-- 10. alpha-reg UPDATE refusé
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- L'UPDATE renvoie 0 ligne affectée plutôt qu'une erreur 42501 : la policy
-- USING filtre la ligne hors du jeu modifiable. C'est le comportement
-- standard de Postgres RLS pour un USING qui ne matche pas.
select is(
  (select count(*)::int
     from (
       update public.drivers
         set telephone = '0692999999'
         where id = 'cccccccc-0000-0000-0000-000000000001'
         returning 1
     ) as t),
  0,
  'alpha-reg UPDATE driver filtré par USING (0 ligne affectée)'
);

-- -----------------------------------------------------------------------------
-- 11. DELETE refusé pour tous (pas de policy DELETE)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.drivers
       where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'DELETE driver refusé (archivage logique uniquement)'
);

-- -----------------------------------------------------------------------------
-- 12. Audit log driver.insert + driver.update présents
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select ok(
  (select
     bool_and(action_present)
     from (
       select exists(
         select 1 from public.audit_logs
          where action = 'driver.insert'
            and entity_type = 'driver'
            and organization_id = '11111111-1111-1111-1111-111111111111'
       ) as action_present
       union all
       select exists(
         select 1 from public.audit_logs
          where action = 'driver.update'
            and entity_type = 'driver'
            and organization_id = '11111111-1111-1111-1111-111111111111'
       )
     ) as t),
  'audit_logs reçoit driver.insert ET driver.update'
);

-- -----------------------------------------------------------------------------
-- 13. Grants : authenticated SELECT/INSERT/UPDATE OK ; pas de DELETE ; anon refusé
-- -----------------------------------------------------------------------------
select ok(
  has_table_privilege('authenticated', 'public.drivers', 'SELECT')
    and has_table_privilege('authenticated', 'public.drivers', 'INSERT')
    and has_table_privilege('authenticated', 'public.drivers', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.drivers', 'DELETE')
    and not has_table_privilege('anon', 'public.drivers', 'SELECT'),
  'Grants drivers : authenticated SELECT/INSERT/UPDATE OK ; DELETE refusé ; anon refusé'
);

select * from finish();
rollback;
