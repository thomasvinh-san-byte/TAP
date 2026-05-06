-- =============================================================================
-- Tests pgTAP — Fondations multi-tenant
-- =============================================================================
-- Vérifie :
--   - structure (tables, types, fonctions)
--   - RLS activée sur toutes les tables métier
--   - isolation tenant (org A ne voit pas org B)
--   - droits par rôle (dirigeant peut, regulateur/chauffeur ne peuvent pas)
--   - anti-élévation de privilège (un user ne change ni rôle ni org)
-- =============================================================================

begin;

select plan(18);

-- -----------------------------------------------------------------------------
-- 1. Structure
-- -----------------------------------------------------------------------------
select has_table('public', 'organizations', 'Table organizations existe');
select has_table('public', 'profiles', 'Table profiles existe');
select has_table('public', 'audit_logs', 'Table audit_logs existe');
select has_type('public', 'user_role', 'Type user_role existe');
select has_function('public', 'current_organization_id', 'Helper current_organization_id existe');
select has_function('public', 'current_user_role', 'Helper current_user_role existe');

-- -----------------------------------------------------------------------------
-- 2. RLS activée et forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'RLS activée sur organizations'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS activée sur profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass),
  'RLS activée sur audit_logs'
);

-- -----------------------------------------------------------------------------
-- 3. Préparer 2 organizations + 2 dirigeants pour tester l'isolation
-- -----------------------------------------------------------------------------
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
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap');

-- -----------------------------------------------------------------------------
-- 4. Isolation tenant : Alpha ne voit pas Bravo
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select count(*)::int from public.organizations),
  1,
  'Dirigeant Alpha ne voit que sa propre organization (1 sur 2)'
);

select is(
  (select id from public.organizations limit 1),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'L''organization visible est bien Alpha'
);

select is(
  (select count(*)::int from public.profiles),
  2,
  'Dirigeant Alpha voit les profils de son org uniquement (2 sur 3)'
);

-- -----------------------------------------------------------------------------
-- 5. Régulateur : pas d'accès aux audit_logs
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Créer un log via service_role n'est pas testable ici sans RESET, on teste
-- juste que le SELECT renvoie 0 (pas dirigeant).
insert into public.audit_logs (organization_id, actor_id, actor_role, action, entity_type)
values ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'regulateur', 'login', 'auth');

select is(
  (select count(*)::int from public.audit_logs),
  0,
  'Régulateur ne peut pas lire les audit_logs (réservé dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 6. Anti-élévation de privilège : régulateur ne peut pas se promouvoir
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.profiles
       set role = 'dirigeant'
     where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  '42501',
  null,
  'Régulateur ne peut pas s''auto-promouvoir dirigeant'
);

select throws_ok(
  $$ update public.profiles
       set organization_id = '22222222-2222-2222-2222-222222222222'
     where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  '42501',
  null,
  'Régulateur ne peut pas changer d''organization'
);

select throws_ok(
  $$ update public.profiles
       set actif = false
     where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  '42501',
  null,
  'Régulateur ne peut pas se désactiver lui-même'
);

-- -----------------------------------------------------------------------------
-- 7. Régulateur peut modifier ses propres infos non sensibles
-- -----------------------------------------------------------------------------
update public.profiles
  set telephone = '0692000000'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select is(
  (select telephone from public.profiles
   where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  '0692000000',
  'Régulateur peut modifier son téléphone'
);

-- -----------------------------------------------------------------------------
-- 8. Dirigeant peut élever un membre de SON organization
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

update public.profiles
  set role = 'regulateur'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select is(
  (select role from public.profiles
   where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'regulateur'::public.user_role,
  'Dirigeant peut modifier le rôle d''un membre de son org'
);

-- -----------------------------------------------------------------------------
-- 9. Dirigeant Alpha NE peut PAS toucher au profil de Bravo (RLS isolation)
-- -----------------------------------------------------------------------------
update public.profiles
  set telephone = '9999999999'
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

reset role;
reset "request.jwt.claim.sub";

select is(
  (select telephone from public.profiles
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  null,
  'Dirigeant Alpha ne peut pas modifier un profil de Bravo'
);

-- -----------------------------------------------------------------------------
-- 10. Helpers retournent NULL pour utilisateur non authentifié
-- -----------------------------------------------------------------------------
select is(
  public.current_organization_id(),
  null,
  'current_organization_id() = NULL hors session'
);

select is(
  public.current_user_role(),
  null,
  'current_user_role() = NULL hors session'
);

select * from finish();
rollback;
