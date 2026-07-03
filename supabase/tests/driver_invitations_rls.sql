-- =============================================================================
-- Tests pgTAP — RLS driver_invitations (Phase 04, PLAN-2)
-- =============================================================================
-- Couverture (6 tests minimum spec PLAN-2 §2.2) :
--   1. dirigeant peut INSERT invitation pour sa propre organization
--   2. dirigeant ne peut PAS INSERT invitation pour autre organization (RLS bloque)
--   3. chauffeur destinataire peut SELECT son invitation par match email
--   4. chauffeur destinataire peut UPDATE status='accepted' pendant validité
--   5. chauffeur destinataire ne peut PAS UPDATE après expires_at passé
--   6. unique index pending empêche 2e insert pending même email
--
-- Tests bonus (defense in depth) :
--   7. RLS activée + forcée
--   8. régulateur INSERT refusé (rôle non dirigeant)
--   9. DELETE refusé pour tous (pas de policy DELETE)
--  10. Grants : authenticated SELECT/INSERT/UPDATE ; anon refusé ; pas de DELETE
--  11. Audit log driver_invited émis sur INSERT
--  12. Audit log driver_invitation_accepted émis sur transition pending→accepted
--
-- Pattern dérivé de supabase/tests/drivers_rls.sql.
-- Conformité NFR-001 : aucun nom propre dans les fixtures (alias génériques).
-- =============================================================================

begin;

select plan(12);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant : Org Alpha + Org Bravo + 4 users
-- (3 rôles Alpha + dirigeant Bravo) — emails génériques, pas de noms propres.
-- -----------------------------------------------------------------------------
-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true); end $$;
-- Note : alpha-invitee n'a PAS de profiles entry — c'est volontaire, l'invitee
-- est un compte auth.users sans profiles tant qu'il n'a pas accepté.

-- -----------------------------------------------------------------------------
-- 1. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.driver_invitations'::regclass)
    and (select relforcerowsecurity from pg_class where oid = 'public.driver_invitations'::regclass),
  'RLS activée ET forcée sur driver_invitations'
);

-- -----------------------------------------------------------------------------
-- 2. alpha-dir INSERT invitation pour sa propre organization (OK)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.driver_invitations
       (id, organization_id, invited_by, email)
     values
       ('11111111-aaaa-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'alpha-invitee@test.tap') $$,
  'alpha-dir INSERT invitation OK (même organization)'
);

-- -----------------------------------------------------------------------------
-- 3. bravo-dir ne peut PAS INSERT invitation pour Org Alpha (cross-org refusé)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select throws_ok(
  $$ insert into public.driver_invitations
       (organization_id, invited_by, email)
     values
       ('11111111-1111-1111-1111-111111111111',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'intrusion@test.tap') $$,
  '42501',
  null,
  'bravo-dir refusé INSERT invitation cross-org (WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 4. alpha-reg INSERT refusé (régulateur n'est pas dirigeant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.driver_invitations
       (organization_id, invited_by, email)
     values
       ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'other-invitee@test.tap') $$,
  '42501',
  null,
  'alpha-reg refusé INSERT invitation (rôle non dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 5. chauffeur destinataire SELECT son invitation par match email
-- (alpha-invitee voit la ligne créée pour 'alpha-invitee@test.tap')
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select is(
  (select count(*)::int from public.driver_invitations
    where email = 'alpha-invitee@test.tap'),
  1,
  'destinataire SELECT invitation via match email auth.users'
);

-- -----------------------------------------------------------------------------
-- 6. bravo-dir ne voit pas l'invitation Alpha (cross-tenant strict)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.driver_invitations),
  0,
  'bravo-dir ne voit aucune invitation Alpha (SELECT cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 7. destinataire UPDATE status='accepted' pendant validité (OK)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select lives_ok(
  $$ update public.driver_invitations
       set status = 'accepted', accepted_at = now()
       where id = '11111111-aaaa-0000-0000-000000000001' $$,
  'destinataire UPDATE status=accepted OK pendant validité'
);

-- -----------------------------------------------------------------------------
-- 8. destinataire ne peut PAS UPDATE après expires_at passé
-- (on crée une 2e invitation expirée, l'invitee tente d'accepter → filtré)
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
-- Insert direct (bypass RLS via role superuser) d'une invitation déjà expirée.
insert into public.driver_invitations
  (id, organization_id, invited_by, email, status, expires_at)
values
  ('11111111-aaaa-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'alpha-invitee@test.tap',
   'pending',
   now() - interval '1 hour');

set local role authenticated;
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
-- L'UPDATE renvoie 0 ligne affectée : USING filtre (now() < expires_at faux).
select is(
  (select count(*)::int
     from (
       update public.driver_invitations
         set status = 'accepted', accepted_at = now()
         where id = '11111111-aaaa-0000-0000-000000000002'
         returning 1
     ) as t),
  0,
  'destinataire UPDATE refusé après expires_at (0 ligne, USING filtre)'
);

-- -----------------------------------------------------------------------------
-- 9. Unique index pending : 2e INSERT pending même email refusé
-- (la 1re invitation alpha-invitee@test.tap est 'accepted' depuis le test 7,
--  donc on peut créer une nouvelle 'pending' ; ensuite la 3e échoue.)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- 1re re-invite pending pour ce même email (OK, l'ancienne est 'accepted')
select lives_ok(
  $$ insert into public.driver_invitations
       (id, organization_id, invited_by, email)
     values
       ('11111111-aaaa-0000-0000-000000000003',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'second-invitee@test.tap') $$,
  '1re invitation pending second-invitee@test.tap OK'
);

-- 2e tentative pending même email → unique index 23505 attendu
select throws_ok(
  $$ insert into public.driver_invitations
       (id, organization_id, invited_by, email)
     values
       ('11111111-aaaa-0000-0000-000000000004',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'second-invitee@test.tap') $$,
  '23505',
  null,
  'unique index pending refuse 2e invitation pending même email'
);

-- -----------------------------------------------------------------------------
-- 10. DELETE refusé pour tous (pas de policy DELETE)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.driver_invitations
       where id = '11111111-aaaa-0000-0000-000000000001' $$,
  '42501',
  null,
  'DELETE driver_invitation refusé (archivage logique status=revoked)'
);

-- -----------------------------------------------------------------------------
-- 11. Audit logs driver_invited ET driver_invitation_accepted émis
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select ok(
  exists(
    select 1 from public.audit_logs
     where action = 'driver_invited'
       and entity_type = 'driver_invitation'
       and organization_id = '11111111-1111-1111-1111-111111111111'
  )
  and exists(
    select 1 from public.audit_logs
     where action = 'driver_invitation_accepted'
       and entity_type = 'driver_invitation'
       and organization_id = '11111111-1111-1111-1111-111111111111'
  ),
  'audit_logs reçoit driver_invited ET driver_invitation_accepted'
);

-- -----------------------------------------------------------------------------
-- 12. Grants : authenticated SELECT/INSERT/UPDATE OK ; DELETE refusé ; anon refusé
-- -----------------------------------------------------------------------------
select ok(
  has_table_privilege('authenticated', 'public.driver_invitations', 'SELECT')
    and has_table_privilege('authenticated', 'public.driver_invitations', 'INSERT')
    and has_table_privilege('authenticated', 'public.driver_invitations', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.driver_invitations', 'DELETE')
    and not has_table_privilege('anon', 'public.driver_invitations', 'SELECT'),
  'Grants driver_invitations : authenticated SELECT/INSERT/UPDATE OK ; DELETE refusé ; anon refusé'
);

select * from finish();
rollback;
