-- =============================================================================
-- Tests pgTAP — RLS sms_messages (Phase 06.21)
-- =============================================================================
-- Policy (migration 20260519000004_sms_messages.sql) :
--   - SELECT : same_org (régulateur + dirigeant + chauffeur).
--   - Pas de policy INSERT / UPDATE / DELETE applicative — écriture via
--     service_role uniquement (Edge Function SMS / cron Phase 06).
--   - NOTE : `force row level security` PAS posé. Choix Phase 05.
-- =============================================================================

begin;

select plan(5);

insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@t', crypt('p', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'regulateur', 'A', 'R', 'c@t'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'regulateur', 'B', 'R', 'd@t');

insert into public.patients (id, organization_id, nom, prenom, date_naissance, adresse_ligne1, code_postal, ville, canal_contact_prefere) values
  ('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', 'X', 'Y', '1980-01-23', 'X', '97400', 'Saint-Denis', 'sms');

-- Seed 1 sms_message Alpha (via service_role bypass dans le test)
set local role postgres;
insert into public.sms_messages (id, organization_id, patient_id, body, delivery_status, created_at) values
  ('77777777-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'Test', 'queued', now());

-- 1. RLS activée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sms_messages'::regclass),
  'RLS activée sur sms_messages'
);

-- 2. alpha-reg voit son message
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select cmp_ok(
  (select count(*)::int from public.sms_messages where organization_id = '11111111-1111-1111-1111-111111111111'),
  '>=', 1, 'alpha-reg voit son sms_message (SELECT same_org)'
);

-- 3. bravo-reg ne voit pas le message Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.sms_messages where organization_id = '11111111-1111-1111-1111-111111111111'),
  0, 'bravo-reg cross-tenant : 0 message Alpha'
);

-- 4. authenticated ne peut PAS INSERT (pas de policy INSERT applicative)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.sms_messages (organization_id, patient_id, body, delivery_status) values
       ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'X', 'queued') $$,
  '42501', null,
  'authenticated refusé INSERT (pas de policy ; service_role only via Edge Function)'
);

-- 5. anon refusé
select ok(
  not has_table_privilege('anon', 'public.sms_messages', 'SELECT'),
  'anon refusé sur sms_messages'
);

select * from finish();
rollback;
