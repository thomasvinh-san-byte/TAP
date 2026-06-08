-- =============================================================================
-- Tests pgTAP — RLS compliance_items (Phase 06.33)
-- =============================================================================
-- Policies (migration 20260608000001_compliance_items.sql) :
--   - SELECT : same_org (dirigeant + régulateur lisent leur conformité).
--   - INSERT/UPDATE : dirigeant uniquement + same_org.
--   - Pas de DELETE — archivage logique via colonne archive.
-- =============================================================================

begin;

select plan(10);

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

-- 1. RLS activée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.compliance_items'::regclass),
  'RLS activée sur compliance_items'
);

-- 2. RLS forcée
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.compliance_items'::regclass),
  'RLS forcée sur compliance_items'
);

-- 3. alpha-dir INSERT échéance organisation (convention CGSS) OK
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.compliance_items (organization_id, entity_type, kind, label, expires_at)
     values ('11111111-1111-1111-1111-111111111111', 'organization', 'convention_cgss', 'Convention initiale', '2027-01-01') $$,
  'alpha-dir INSERT échéance organisation OK'
);

-- 4. alpha-dir INSERT échéance chauffeur (carte pro) OK
select lives_ok(
  $$ insert into public.compliance_items (organization_id, entity_type, entity_id, kind, expires_at)
     values ('11111111-1111-1111-1111-111111111111', 'driver', '99999999-9999-9999-9999-999999999999', 'carte_pro', '2026-09-30') $$,
  'alpha-dir INSERT échéance chauffeur OK'
);

-- 5. alpha-dir voit ses 2 items
select cmp_ok(
  (select count(*)::int from public.compliance_items where organization_id = '11111111-1111-1111-1111-111111111111'),
  '=', 2,
  'alpha-dir voit ses 2 items'
);

-- 6. alpha-reg INSERT refusé (seul dirigeant)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.compliance_items (organization_id, entity_type, entity_id, kind, expires_at)
     values ('11111111-1111-1111-1111-111111111111', 'driver', '88888888-8888-8888-8888-888888888888', 'visite_medicale', '2026-12-31') $$,
  '42501', null, 'alpha-reg refusé INSERT (seul dirigeant)'
);

-- 7. alpha-reg voit (SELECT same_org)
select cmp_ok(
  (select count(*)::int from public.compliance_items where organization_id = '11111111-1111-1111-1111-111111111111'),
  '=', 2,
  'alpha-reg voit la conformité de son org (SELECT same_org)'
);

-- 8. bravo-dir cross-tenant : ne voit pas Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.compliance_items where organization_id = '11111111-1111-1111-1111-111111111111'),
  0, 'bravo-dir ne voit pas la conformité Alpha (cross-tenant)'
);

-- 9. anon refusé SELECT
select ok(
  not has_table_privilege('anon', 'public.compliance_items', 'SELECT'),
  'anon refusé sur compliance_items'
);

-- 10. CHECK entity_id : driver sans entity_id rejeté
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ insert into public.compliance_items (organization_id, entity_type, kind, expires_at)
     values ('11111111-1111-1111-1111-111111111111', 'driver', 'carte_pro', '2026-09-30') $$,
  '23514', null, 'CHECK entity_id : driver sans entity_id rejeté'
);

select * from finish();
rollback;
