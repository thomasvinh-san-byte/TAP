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
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap');

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

-- 8. DELETE refusé pour tous (versionnement strict — aucune policy)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.ordering_party_tariff_grids
       where ordering_party_id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '42501', null,
  'DELETE grille B2B refusé (versionnement strict)'
);

-- 9. Grants : authenticated SELECT/INSERT ; pas de UPDATE/DELETE ; anon refusé
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.ordering_party_tariff_grids', 'SELECT')
    and has_table_privilege('authenticated', 'public.ordering_party_tariff_grids', 'INSERT')
    and not has_table_privilege('authenticated', 'public.ordering_party_tariff_grids', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ordering_party_tariff_grids', 'DELETE')
    and not has_table_privilege('anon', 'public.ordering_party_tariff_grids', 'SELECT'),
  'Grants : authenticated SELECT/INSERT ; UPDATE/DELETE refusés ; anon refusé'
);

select * from finish();
rollback;
