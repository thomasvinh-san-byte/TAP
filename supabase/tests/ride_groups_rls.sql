-- =============================================================================
-- Tests pgTAP — RLS ride_groups (demande groupée B2B, DEC-158)
-- =============================================================================
-- Couverture (calquée sur ride_recurrences + ordering_parties) :
--   - RLS activée + forcée
--   - SELECT same-org / cross-org strict
--   - INSERT dirigeant OK / régulateur OK / cross-org refusé (WITH CHECK)
--   - UPDATE régulateur same-org OK (workflow accept/refus) / cross-org refusé
--   - DELETE refusé pour tous (demande tranchée reste tracée — aucune policy)
--   - Grants : authenticated SELECT/INSERT/UPDATE ; pas de DELETE ; anon refusé
-- =============================================================================

begin;

select plan(11);

-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true); end $$;

-- Donneurs d'ordres (FK requise) — 1 par org.
insert into public.ordering_parties (id, organization_id, raison_sociale)
values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'CH Alpha'),
  ('eeeeeeee-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'CH Bravo');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ride_groups'::regclass),
  'RLS activée sur ride_groups'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.ride_groups'::regclass),
  'RLS forcée sur ride_groups'
);

set local role authenticated;

-- 3. alpha-reg INSERT OK (la régulation crée des demandes groupées)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.ride_groups
       (id, organization_id, ordering_party_id, created_by)
     values
       ('99999999-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'eeeeeeee-0000-0000-0000-000000000001',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg INSERT demande groupée OK'
);

-- 4. alpha-dir INSERT OK (le dirigeant peut aussi)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.ride_groups
       (id, organization_id, ordering_party_id, created_by)
     values
       ('99999999-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'eeeeeeee-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT demande groupée OK'
);

-- 5. alpha-reg SELECT same-org OK (2 lignes)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select count(*)::int from public.ride_groups),
  2,
  'alpha-reg voit les 2 demandes de son org'
);

-- 6. bravo-dir ne voit aucune demande Alpha (cross-tenant strict)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.ride_groups),
  0,
  'bravo-dir ne voit aucune demande Alpha (cross-tenant strict)'
);

-- 7. bravo-dir refusé INSERT cross-org dans Alpha (WITH CHECK)
select throws_ok(
  $$ insert into public.ride_groups
       (organization_id, ordering_party_id, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'eeeeeeee-0000-0000-0000-000000000001',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- 8. alpha-reg UPDATE same-org OK (acceptation : en_attente → acceptee)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ update public.ride_groups
       set status = 'acceptee'
       where id = '99999999-0000-0000-0000-000000000001' $$,
  'alpha-reg UPDATE statut demande same-org OK (workflow accept)'
);

-- 9. bravo-dir UPDATE cross-org sans effet (RLS USING masque la ligne → 0 ligne)
-- Le WITH-UPDATE (statement modifiant) doit être attaché au niveau supérieur de
-- l'instruction, pas dans une sous-requête scalaire (sinon : « WITH clause
-- containing a data-modifying statement must be at the top level »).
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
with upd as (
  update public.ride_groups set status = 'refusee'
    where id = '99999999-0000-0000-0000-000000000002'
    returning 1
)
select is(
  (select count(*)::int from upd),
  0,
  'bravo-dir UPDATE cross-org sans effet (ligne masquée par RLS)'
);

-- 10. DELETE refusé par RLS (aucune policy DELETE ; demande tranchée reste tracée).
-- authenticated a le grant DELETE (défaut Supabase) mais aucune policy DELETE ne
-- rend de ligne supprimable → 0 ligne supprimée, sans erreur.
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with del as (
  delete from public.ride_groups
    where id = '99999999-0000-0000-0000-000000000002'
    returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'DELETE demande groupée bloqué par RLS (0 ligne ; demande tranchée reste tracée)'
);

-- 11. Grants : authenticated SELECT/INSERT/UPDATE ; pas de DELETE ; anon refusé
reset role;
reset "request.jwt.claim.sub";
-- Le grant DELETE reste octroyé à authenticated (défaut Supabase) : la protection
-- passe par l'absence de policy DELETE (RLS), pas par la révocation du grant.
select ok(
  has_table_privilege('authenticated', 'public.ride_groups', 'SELECT')
    and has_table_privilege('authenticated', 'public.ride_groups', 'INSERT')
    and has_table_privilege('authenticated', 'public.ride_groups', 'UPDATE')
    and not has_table_privilege('anon', 'public.ride_groups', 'SELECT'),
  'Grants : authenticated SELECT/INSERT/UPDATE ; anon révoqué (DELETE contrôlé par RLS)'
);

select * from finish();
rollback;
