-- =============================================================================
-- Tests pgTAP — RLS cgu_acceptance (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260508000002_legal_additional_tables.sql) :
--   - SELECT : profile_id = auth.uid() (chacun voit son propre acceptance).
--   - INSERT : profile_id = auth.uid() (chacun trace SON acceptance).
--   - Pas de UPDATE / DELETE (immutable).
--   - grant select, insert to authenticated ; revoke all from anon.
-- =============================================================================

begin;

select plan(7);

insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'regulateur', 'A', 'R', 'c@t'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'dirigeant', 'B', 'D', 'd@t');

-- 1. RLS activée + forcée
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.cgu_acceptance'::regclass),
  'RLS activée + forcée sur cgu_acceptance'
);

-- 2. user-c INSERT son propre acceptance OK
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.cgu_acceptance (profile_id, version, document_type) values
       ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2026.06', 'cgu') $$,
  'user-c INSERT son propre acceptance OK'
);

-- 3. user-c INSERT pour quelqu'un d'autre refusé (WITH CHECK)
select throws_ok(
  $$ insert into public.cgu_acceptance (profile_id, version, document_type) values
       ('dddddddd-dddd-dddd-dddd-dddddddddddd', '2026.06', 'cgu') $$,
  '42501', null,
  'user-c refusé INSERT pour profile_id d''un autre (WITH CHECK profile_id = auth.uid())'
);

-- 4. user-c SELECT voit ses propres acceptances seulement
select is(
  (select count(*)::int from public.cgu_acceptance),
  1, 'user-c voit 1 ligne (la sienne)'
);

-- 5. user-d ne voit pas l'acceptance de user-c
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.cgu_acceptance),
  0, 'user-d ne voit pas l''acceptance de user-c'
);

-- 6. grants : authenticated select+insert, pas update/delete
select ok(
  has_table_privilege('authenticated', 'public.cgu_acceptance', 'SELECT')
    and has_table_privilege('authenticated', 'public.cgu_acceptance', 'INSERT')
    and not has_table_privilege('authenticated', 'public.cgu_acceptance', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.cgu_acceptance', 'DELETE'),
  'authenticated : SELECT+INSERT seuls ; UPDATE/DELETE refusés'
);

-- 7. anon refusé
select ok(
  not has_table_privilege('anon', 'public.cgu_acceptance', 'SELECT'),
  'anon refusé sur cgu_acceptance'
);

select * from finish();
rollback;
