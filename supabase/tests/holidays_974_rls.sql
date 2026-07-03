-- =============================================================================
-- Tests pgTAP — RLS holidays_974 (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260519000003_holidays_974.sql) :
--   - SELECT : authenticated true (référentiel public 974 — jours fériés).
--   - Pas de policy INSERT / UPDATE / DELETE (référentiel seedé).
-- =============================================================================

begin;

select plan(4);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_alpha_dirigeant => false); end $$;

-- 1. RLS activée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.holidays_974'::regclass),
  'RLS activée sur holidays_974'
);

-- 2. authenticated voit les jours fériés (seed migration)
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select cmp_ok(
  (select count(*)::int from public.holidays_974),
  '>=', 1, 'authenticated voit les jours fériés (référentiel public 974)'
);

-- 3. authenticated INSERT refusé (pas de policy)
select throws_ok(
  $$ insert into public.holidays_974 (date, label) values ('2030-01-01', 'X') $$,
  '42501', null, 'authenticated refusé INSERT (référentiel seedé only)'
);

-- 4. anon refusé (revoke implicite via authenticated only grant)
select ok(
  not has_table_privilege('anon', 'public.holidays_974', 'SELECT'),
  'anon refusé sur holidays_974'
);

select * from finish();
rollback;
