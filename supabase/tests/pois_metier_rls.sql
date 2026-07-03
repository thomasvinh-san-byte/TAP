-- =============================================================================
-- Tests pgTAP — RLS pois_metier (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260516000004_pois_metier.sql) :
--   - SELECT : same_org (picker régulateur a besoin de tout le référentiel).
--   - ALL (INSERT/UPDATE/DELETE) : dirigeant OU régulateur + same_org.
--   - `force row level security` posé.
-- =============================================================================

begin;

select plan(7);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true, second_org_role => 'regulateur', with_chauffeur => true, with_alpha_dirigeant => false); end $$;

-- 1. RLS activée + forcée
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pois_metier'::regclass),
  'RLS activée + forcée sur pois_metier'
);

-- 2. alpha-reg INSERT OK
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.pois_metier (organization_id, nom_court, type_poi, adresse, code_postal, ville) values
       ('11111111-1111-1111-1111-111111111111', 'CHU FG', 'hopital', '12 av FG', '97400', 'Saint-Denis') $$,
  'alpha-reg INSERT POI OK'
);

-- 3. bravo-reg ne voit pas le POI Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.pois_metier where organization_id = '11111111-1111-1111-1111-111111111111'),
  0, 'bravo-reg cross-tenant : 0 POI Alpha'
);

-- 4. bravo-reg INSERT cross-org refusé
select throws_ok(
  $$ insert into public.pois_metier (organization_id, nom_court, type_poi, adresse, code_postal, ville) values
       ('11111111-1111-1111-1111-111111111111', 'X', 'hopital', 'X', '97400', 'Saint-Denis') $$,
  '42501', null, 'bravo-reg refusé INSERT cross-org'
);

-- 5. alpha-chauffeur INSERT refusé (rôle non listé)
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ insert into public.pois_metier (organization_id, nom_court, type_poi, adresse, code_postal, ville) values
       ('11111111-1111-1111-1111-111111111111', 'X', 'hopital', 'X', '97400', 'Saint-Denis') $$,
  '42501', null, 'alpha-chauffeur refusé INSERT (rôle non listé)'
);

-- 6. alpha-chauffeur peut SELECT same_org (le picker reg consomme, mais
-- le SELECT est ouvert à tout authenticated same-org)
select cmp_ok(
  (select count(*)::int from public.pois_metier where organization_id = '11111111-1111-1111-1111-111111111111'),
  '>=', 1, 'alpha-chauffeur voit les POI de son org (SELECT same_org)'
);

-- 7. anon refusé
select ok(
  not has_table_privilege('anon', 'public.pois_metier', 'SELECT'),
  'anon refusé sur pois_metier'
);

select * from finish();
rollback;
