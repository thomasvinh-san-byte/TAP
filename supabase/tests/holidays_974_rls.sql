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

-- 4. anon ne voit aucun jour férié : le grant SELECT reste octroyé à anon (défaut
-- Supabase, référentiel sans revoke), mais la policy SELECT vise le rôle
-- `authenticated` uniquement → aucune policy pour anon → 0 ligne (RLS).
reset "request.jwt.claim.sub";
set local role anon;
select is(
  (select count(*)::int from public.holidays_974),
  0,
  'anon ne voit aucun jour férié (RLS : policy SELECT réservée à authenticated)'
);
reset role;

select * from finish();
rollback;
