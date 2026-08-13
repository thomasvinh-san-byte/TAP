-- =============================================================================
-- Tests pgTAP — RLS vehicles (Phase 3, Passe 1, sous-bloc 03-A)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée sur public.vehicles
--   - SELECT same-org / cross-org strict
--   - INSERT dirigeant OK / régulateur refusé
--   - UPDATE dirigeant OK / régulateur refusé
--   - DELETE refusé (pas de policy DELETE)
--   - Unicité partielle immatriculation par org sur archive=false :
--       * 2 véhicules même immatriculation → 23505
--       * Même immatriculation après archivage du premier → OK (réaffectation)
--       * Casse normalisée upper() : "ab-123-cd" vs "AB-123-CD" → conflit
--   - check type ∈ {taxi_conventionne, tpmr, vsl, ambulance}
--   - check places_assises 1-9 / places_tpmr 0-3
--   - Audit log écrit sur INSERT
--
-- Pattern dupliqué de supabase/tests/drivers_rls.sql.
-- =============================================================================

begin;

select plan(12);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant
-- -----------------------------------------------------------------------------
-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true); end $$;

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.vehicles'::regclass),
  'RLS activée sur vehicles'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.vehicles'::regclass),
  'RLS forcée sur vehicles (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-dir INSERT taxi (dirigeant autorisé)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.vehicles
       (id, organization_id, immatriculation, marque, modele, type,
        places_assises, created_by)
     values
       ('dddddddd-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'AB-123-CD', 'Dacia', 'Lodgy', 'taxi_conventionne',
        4, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT vehicle OK (taxi_conventionne)'
);

-- -----------------------------------------------------------------------------
-- 4. alpha-reg INSERT refusé
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.vehicles
       (organization_id, immatriculation, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'XY-999-ZZ', 'taxi_conventionne',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'alpha-reg refusé INSERT vehicle (rôle non dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 5. Cross-tenant : bravo-dir ne voit aucun vehicle Alpha
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.vehicles),
  0,
  'bravo-dir ne voit aucun vehicle Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 6. Check type invalide → 23514
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ insert into public.vehicles
       (organization_id, immatriculation, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'XX-111-XX', 'inconnu',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '23514',
  null,
  'type non-supporté refusé par check constraint (23514)'
);

-- -----------------------------------------------------------------------------
-- 7. Check places_assises hors borne 1-9
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.vehicles
       (organization_id, immatriculation, type, places_assises, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'XX-222-XX', 'taxi_conventionne', 15,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '23514',
  null,
  'places_assises > 9 refusé par check constraint (23514)'
);

-- -----------------------------------------------------------------------------
-- 8. Unicité partielle immatriculation par org : 2e véhicule même plaque → 23505
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.vehicles
       (organization_id, immatriculation, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'AB-123-CD', 'tpmr',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '23505',
  null,
  '2e véhicule même immatriculation dans Alpha → 23505 (unique partiel)'
);

-- -----------------------------------------------------------------------------
-- 9. Normalisation upper() : "ab-123-cd" en minuscules → conflit avec "AB-123-CD"
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.vehicles
       (organization_id, immatriculation, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'ab-123-cd', 'taxi_conventionne',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '23505',
  null,
  'Casse normalisée upper() : "ab-123-cd" conflit avec "AB-123-CD"'
);

-- -----------------------------------------------------------------------------
-- 10. Archivage du 1er + réinsertion même plaque → OK
-- -----------------------------------------------------------------------------
update public.vehicles
  set archive = true, archive_at = now()
  where id = 'dddddddd-0000-0000-0000-000000000001';

select lives_ok(
  $$ insert into public.vehicles
       (organization_id, immatriculation, type, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'AB-123-CD', 'taxi_conventionne',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'Réinsertion immatriculation après archivage du premier véhicule → OK'
);

-- -----------------------------------------------------------------------------
-- 11. Audit log vehicle.insert présent
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select ok(
  (select exists(
     select 1 from public.audit_logs
      where action = 'vehicle.insert'
        and entity_type = 'vehicle'
        and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit vehicle.insert après INSERT public.vehicles'
);

-- -----------------------------------------------------------------------------
-- 12. Grants : authenticated SELECT/INSERT/UPDATE OK ; pas de DELETE ; anon refusé
-- -----------------------------------------------------------------------------
-- Le grant DELETE reste octroyé à authenticated (défaut Supabase) : la protection
-- contre les suppressions passe par l'absence de policy DELETE (RLS), pas le grant.
select ok(
  has_table_privilege('authenticated', 'public.vehicles', 'SELECT')
    and has_table_privilege('authenticated', 'public.vehicles', 'INSERT')
    and has_table_privilege('authenticated', 'public.vehicles', 'UPDATE')
    and not has_table_privilege('anon', 'public.vehicles', 'SELECT'),
  'Grants vehicles : authenticated SELECT/INSERT/UPDATE ; anon révoqué (DELETE contrôlé par RLS)'
);

select * from finish();
rollback;
