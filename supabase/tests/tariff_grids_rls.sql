-- =============================================================================
-- Tests pgTAP — RLS tariff_grids (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260522000001_tariff_grids.sql) :
--   - SELECT : same_org (régulateur + dirigeant lisent leur grille).
--   - INSERT : dirigeant uniquement + same_org.
--   - PAS de UPDATE / DELETE — versionnement strict (DEC-057).
--
-- NOTE : `force row level security` n'est PAS posé. Choix migration
-- Phase 05.5 conservé (DEC-058) — tracé sans corriger (D-04).
-- =============================================================================

begin;

select plan(8);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true); end $$;

-- La migration ne seede une grille que pour les organisations existant AU MOMENT
-- de la migration. L'Org Alpha est une fixture créée dans la transaction de test :
-- aucune grille seedée ne la concerne. On matérialise ici sa « grille de base »
-- (bypass RLS via le rôle postgres) pour représenter l'état seedé attendu par la
-- suite du test.
set local role postgres;
insert into public.tariff_grids
  (organization_id, date_effet, forfait_eur, km_inclus, prix_km_eur,
   supplement_drom_eur, supplement_tpmr_eur, majoration_pct, facteur_correction_routier)
values
  ('11111111-1111-1111-1111-111111111111', '2026-01-01', 13.00, 4, 1.30,
   3.00, 30.00, 50, 1.40);
reset role;

-- 1. RLS activée (grille de base matérialisée ci-dessus pour l'org fixture Alpha)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tariff_grids'::regclass),
  'RLS activée sur tariff_grids'
);

-- 2. alpha-dir voit la grille Alpha (seed migration)
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select cmp_ok(
  (select count(*)::int from public.tariff_grids where organization_id = '11111111-1111-1111-1111-111111111111'),
  '>=', 1,
  'alpha-dir voit la grille Alpha (seed)'
);

-- 3. alpha-dir INSERT nouvelle grille OK
select lives_ok(
  $$ insert into public.tariff_grids (organization_id, date_effet, forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, supplement_tpmr_eur, majoration_pct, facteur_correction_routier, created_by) values
       ('11111111-1111-1111-1111-111111111111', '2026-12-01', 14.00, 4, 1.30, 3.00, 30.00, 50, 1.40, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT nouvelle grille OK'
);

-- 4. alpha-reg INSERT refusé (seul dirigeant)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.tariff_grids (organization_id, date_effet, forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, supplement_tpmr_eur, majoration_pct, facteur_correction_routier, created_by) values
       ('11111111-1111-1111-1111-111111111111', '2027-01-01', 14.00, 4, 1.30, 3.00, 30.00, 50, 1.40, 'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', null, 'alpha-reg refusé INSERT (seul dirigeant)'
);

-- 5. alpha-reg voit la grille Alpha (régulateur peut LIRE)
select cmp_ok(
  (select count(*)::int from public.tariff_grids where organization_id = '11111111-1111-1111-1111-111111111111'),
  '>=', 1, 'alpha-reg voit la grille Alpha (SELECT same_org)'
);

-- 6. bravo-dir cross-tenant : ne voit pas Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.tariff_grids where organization_id = '11111111-1111-1111-1111-111111111111'),
  0, 'bravo-dir ne voit pas la grille Alpha (cross-tenant)'
);

-- 7. UPDATE refusé par RLS (versionnement strict — aucune policy UPDATE). Le grant
-- UPDATE existe (défaut Supabase) mais aucune policy UPDATE ne rend de ligne
-- modifiable → 0 ligne modifiée, sans erreur. WITH-UPDATE au niveau supérieur.
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with upd as (
  update public.tariff_grids set forfait_eur = 99
    where organization_id = '11111111-1111-1111-1111-111111111111'
    returning 1
)
select is(
  (select count(*)::int from upd),
  0,
  'UPDATE grille bloqué par RLS (0 ligne ; versionnement strict, pas de policy UPDATE)'
);

-- 8. anon ne voit aucune grille : le grant SELECT reste octroyé à anon (défaut
-- Supabase, pas de revoke), mais la policy SELECT est same_org et
-- current_organization_id() est NULL pour anon → 0 ligne (RLS).
reset "request.jwt.claim.sub";
set local role anon;
select is(
  (select count(*)::int from public.tariff_grids),
  0,
  'anon ne voit aucune grille (RLS same_org, org NULL pour anon)'
);
reset role;

select * from finish();
rollback;
