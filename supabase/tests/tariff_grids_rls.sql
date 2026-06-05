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

insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'dirigeant', 'A', 'D', 'a@t'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'regulateur', 'A', 'R', 'c@t'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'dirigeant', 'B', 'D', 'd@t');

-- 1. RLS activée (seed insert depuis la migration crée 1 grille par org existante)
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

-- 7. UPDATE refusé (versionnement strict — pas de policy UPDATE)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ update public.tariff_grids set forfait_eur = 99 where organization_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'UPDATE refusé (versionnement strict, pas de policy UPDATE)'
);

-- 8. anon refusé
select ok(
  not has_table_privilege('anon', 'public.tariff_grids', 'SELECT'),
  'anon refusé sur tariff_grids'
);

select * from finish();
rollback;
