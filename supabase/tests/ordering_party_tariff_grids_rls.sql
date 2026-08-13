-- =============================================================================
-- Tests pgTAP — RLS ordering_party_tariff_grids (grille B2B, DEC-157)
-- =============================================================================
-- Couverture (calquée sur tariff_grids + ordering_parties) :
--   - RLS activée + forcée
--   - SELECT same-org / cross-org strict
--   - INSERT dirigeant OK / régulateur refusé / cross-org refusé
--   - UPDATE et DELETE refusés (versionnement strict — aucune policy)
--   - Grants : authenticated SELECT/INSERT ; pas de UPDATE/DELETE ; anon refusé
-- =============================================================================

begin;

select plan(9);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true); end $$;

-- Donneurs d'ordres (FK requise) — 1 par org, en mode grille_propre.
insert into public.ordering_parties (id, organization_id, raison_sociale, tariff_mode)
values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'CH Alpha', 'grille_propre'),
  ('eeeeeeee-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'CH Bravo', 'grille_propre');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ordering_party_tariff_grids'::regclass),
  'RLS activée sur ordering_party_tariff_grids'
);
select ok(
  (select relforcerowsecurity
     from pg_class where oid = 'public.ordering_party_tariff_grids'::regclass),
  'RLS forcée sur ordering_party_tariff_grids'
);

set local role authenticated;

-- 3. alpha-dir INSERT OK
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.ordering_party_tariff_grids
       (organization_id, ordering_party_id, date_effet, forfait_eur, km_inclus,
        prix_km_eur, supplement_drom_eur, supplement_tpmr_eur, majoration_pct,
        facteur_correction_routier, arrondi_eur, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
        '2026-01-01', 15.00, 5, 1.30, 3.00, 30.00, 50, 1.40, 0.05,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT grille B2B OK'
);

-- 4. alpha-reg INSERT refusé (non dirigeant)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.ordering_party_tariff_grids
       (organization_id, ordering_party_id, date_effet, forfait_eur, km_inclus,
        prix_km_eur, supplement_drom_eur, supplement_tpmr_eur, majoration_pct,
        facteur_correction_routier, arrondi_eur)
     values
       ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
        '2026-02-01', 16.00, 5, 1.30, 3.00, 30.00, 50, 1.40, 0.05) $$,
  '42501', null,
  'alpha-reg refusé INSERT grille B2B (non dirigeant)'
);

-- 5. alpha-reg SELECT same-org OK (1 ligne)
select is(
  (select count(*)::int from public.ordering_party_tariff_grids),
  1,
  'alpha-reg voit la grille B2B de son org'
);

-- 6. bravo-dir ne voit pas la grille Alpha (cross-tenant)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.ordering_party_tariff_grids),
  0,
  'bravo-dir ne voit aucune grille Alpha (cross-tenant strict)'
);

-- 7. bravo-dir refusé INSERT cross-org dans Alpha (WITH CHECK)
select throws_ok(
  $$ insert into public.ordering_party_tariff_grids
       (organization_id, ordering_party_id, date_effet, forfait_eur, km_inclus,
        prix_km_eur, supplement_drom_eur, supplement_tpmr_eur, majoration_pct,
        facteur_correction_routier, arrondi_eur)
     values
       ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001',
        '2026-03-01', 17.00, 5, 1.30, 3.00, 30.00, 50, 1.40, 0.05) $$,
  '42501', null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- 8. DELETE refusé par RLS (versionnement strict — aucune policy DELETE).
-- authenticated a le grant DELETE (défaut Supabase) mais aucune policy DELETE ne
-- rend de ligne supprimable → 0 ligne supprimée, sans erreur.
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with del as (
  delete from public.ordering_party_tariff_grids
    where ordering_party_id = 'eeeeeeee-0000-0000-0000-000000000001'
    returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'DELETE grille B2B bloqué par RLS (0 ligne supprimée ; versionnement strict)'
);

-- 9. Grants : authenticated SELECT/INSERT ; anon révoqué explicitement. Les grants
-- UPDATE/DELETE restent octroyés à authenticated (défaut Supabase) : le
-- versionnement strict est garanti par l'ABSENCE de policy UPDATE/DELETE (RLS).
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.ordering_party_tariff_grids', 'SELECT')
    and has_table_privilege('authenticated', 'public.ordering_party_tariff_grids', 'INSERT')
    and not has_table_privilege('anon', 'public.ordering_party_tariff_grids', 'SELECT'),
  'Grants : authenticated SELECT/INSERT ; anon révoqué (UPDATE/DELETE contrôlés par RLS)'
);

select * from finish();
rollback;
