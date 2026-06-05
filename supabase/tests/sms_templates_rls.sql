-- =============================================================================
-- Tests pgTAP — RLS sms_templates (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260519000005_sms_templates.sql) :
--   - SELECT : authenticated (true) — référentiel partagé.
--   - UPDATE : dirigeant uniquement.
--   - Pas de policy INSERT / DELETE (référentiel seedé via migration).
--   - NOTE : table non multi-tenant (référentiel commun). `force RLS` PAS posé.
-- =============================================================================

begin;

select plan(6);

insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'dirigeant', 'A', 'D', 'a@t'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'regulateur', 'A', 'R', 'c@t');

-- 1. RLS activée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sms_templates'::regclass),
  'RLS activée sur sms_templates'
);

-- 2. Seed migration : 2 templates (j1_reminder + j2h_reminder)
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select cmp_ok(
  (select count(*)::int from public.sms_templates),
  '>=', 2,
  'alpha-reg voit les templates seedés (référentiel partagé authenticated)'
);

-- 3. alpha-reg UPDATE refusé (seul dirigeant)
select throws_ok(
  $$ update public.sms_templates set body = 'X' where key = 'j1_reminder' $$,
  null, null,
  'alpha-reg refusé UPDATE (seul dirigeant)'
);

-- 4. alpha-dir UPDATE OK
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ update public.sms_templates set body = 'updated' where key = 'j1_reminder' $$,
  'alpha-dir UPDATE OK (dirigeant)'
);

-- 5. authenticated INSERT refusé (pas de policy INSERT)
select throws_ok(
  $$ insert into public.sms_templates (key, body) values ('new_key', 'X') $$,
  '42501', null,
  'authenticated refusé INSERT (pas de policy ; seed migration only)'
);

-- 6. anon refusé
select ok(
  not has_table_privilege('anon', 'public.sms_templates', 'SELECT'),
  'anon refusé sur sms_templates'
);

select * from finish();
rollback;
