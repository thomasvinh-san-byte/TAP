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
-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true, with_chauffeur => true); end $$;

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
-- 4. alpha-reg INSERT autorisé (policy drivers_insert_admin_or_regulateur,
--    migration 20260516000001/006 : dirigeant OU régulateur peut créer un driver)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.drivers
       (id, organization_id, nom_affichage, created_by)
     values
       ('cccccccc-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'Maillot André',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg INSERT driver OK (régulateur autorisé par policy)'
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
  2,
  'alpha-reg voit les 2 drivers Alpha via SELECT same_org (créés en tests 3 et 4)'
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
-- 10. alpha-reg UPDATE autorisé (policy drivers_update_admin_or_regulateur :
--     USING = même org, WITH CHECK = dirigeant OU régulateur). Le WITH-UPDATE
--     est au niveau supérieur de l'instruction (un UPDATE ne peut pas figurer
--     dans une sous-requête FROM). 1 ligne modifiée.
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
with upd as (
  update public.drivers
    set telephone = '0692999999'
    where id = 'cccccccc-0000-0000-0000-000000000001'
    returning 1
)
select is(
  (select count(*)::int from upd),
  1,
  'alpha-reg UPDATE driver OK (régulateur autorisé par policy, 1 ligne modifiée)'
);

-- -----------------------------------------------------------------------------
-- 11. DELETE refusé pour tous par RLS (pas de policy DELETE, archivage logique).
-- authenticated a le grant DELETE (défaut Supabase) mais aucune policy DELETE ne
-- rend de ligne supprimable → 0 ligne supprimée, sans erreur. WITH-DELETE au
-- niveau supérieur de l'instruction.
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with del as (
  delete from public.drivers
    where id = 'cccccccc-0000-0000-0000-000000000001'
    returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'DELETE driver bloqué par RLS (0 ligne supprimée ; archivage logique)'
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
-- Le grant DELETE reste octroyé à authenticated (défaut Supabase) : la protection
-- contre les suppressions passe par l'absence de policy DELETE (RLS), pas par le
-- grant. On vérifie les grants positifs + la révocation explicite d'anon.
select ok(
  has_table_privilege('authenticated', 'public.drivers', 'SELECT')
    and has_table_privilege('authenticated', 'public.drivers', 'INSERT')
    and has_table_privilege('authenticated', 'public.drivers', 'UPDATE')
    and not has_table_privilege('anon', 'public.drivers', 'SELECT'),
  'Grants drivers : authenticated SELECT/INSERT/UPDATE ; anon révoqué (DELETE contrôlé par RLS)'
);

select * from finish();
rollback;
