-- =============================================================================
-- Tests pgTAP — RLS sms_templates (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260519000005_sms_templates.sql) :
--   - SELECT : authenticated (true) — référentiel partagé.
--   - UPDATE : dirigeant uniquement.
--   - Pas de policy INSERT / DELETE (référentiel seedé via migration).
--   - NOTE : table non multi-tenant (référentiel commun). `force RLS` PAS posé.
-- =============================================================================

begin;

select plan(6);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(); end $$;

-- 1. RLS activée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sms_templates'::regclass),
  'RLS activée sur sms_templates'
);

-- 2. Seed migration : 2 templates (j1_reminder + j2h_reminder)
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select cmp_ok(
  (select count(*)::int from public.sms_templates),
  '>=', 2,
  'alpha-reg voit les templates seedés (référentiel partagé authenticated)'
);

-- 3. alpha-reg UPDATE refusé (seul dirigeant)
select throws_ok(
  $$ update public.sms_templates set body = 'X' where key = 'j1_reminder' $$,
  null, null,
  'alpha-reg refusé UPDATE (seul dirigeant)'
);

-- 4. alpha-dir UPDATE OK
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ update public.sms_templates set body = 'updated' where key = 'j1_reminder' $$,
  'alpha-dir UPDATE OK (dirigeant)'
);

-- 5. authenticated INSERT refusé (pas de policy INSERT)
select throws_ok(
  $$ insert into public.sms_templates (key, body) values ('new_key', 'X') $$,
  '42501', null,
  'authenticated refusé INSERT (pas de policy ; seed migration only)'
);

-- 6. anon refusé
select ok(
  not has_table_privilege('anon', 'public.sms_templates', 'SELECT'),
  'anon refusé sur sms_templates'
);

select * from finish();
rollback;
