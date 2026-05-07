-- =============================================================================
-- Tests RLS table patient_data_request — Phase 1.5 DPA + RGPD compliance
-- D-09 (token URL signé, deadline 30j), D-16 (dirigeant only), D-18 (RLS),
-- D-19 (audit trigger filtre colonnes sensibles — Pitfall 2 RESEARCH).
-- =============================================================================
-- État RED attendu en Wave 0 : la table public.patient_data_request n'existe
-- pas encore.
--
-- CRITIQUE Pitfall 2 RESEARCH : audit_logs.metadata->'new' ne doit JAMAIS
-- contenir request_token ni requester_proof_of_identity_url.
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant Alpha + Bravo + dirigeant + régulateur
-- (pattern dupliqué de supabase/tests/patients.sql lignes 28-57)
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
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.patient_data_request'::regclass),
  'RLS activée sur patient_data_request'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.patient_data_request'::regclass),
  'RLS forcée sur patient_data_request'
);

-- -----------------------------------------------------------------------------
-- 3. Dirigeant Alpha peut INSERT une demande de droit
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.patient_data_request
       (organization_id, request_type, deadline_at, status,
        request_token, request_token_expires_at, requester_email)
     values
       ('11111111-1111-1111-1111-111111111111', 'acces',
        now() + interval '30 days', 'recue',
        'JWT_FACTICE_TOKEN_SECRET_NE_DOIT_PAS_LEAK',
        now() + interval '30 days',
        'patient@test.tap') $$,
  'Dirigeant Alpha peut INSERT une patient_data_request (D-16)'
);

-- -----------------------------------------------------------------------------
-- 4. D-16 : régulateur Alpha INSERT échoue 42501
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select throws_ok(
  $$ insert into public.patient_data_request
       (organization_id, request_type, deadline_at, status,
        request_token, request_token_expires_at)
     values
       ('11111111-1111-1111-1111-111111111111', 'effacement',
        now() + interval '30 days', 'recue',
        'TOKEN_TENTATIVE', now() + interval '30 days') $$,
  '42501',
  null,
  'Régulateur ne peut PAS INSERT patient_data_request (D-16 dirigeant only)'
);

-- -----------------------------------------------------------------------------
-- 5. Isolation tenant : Bravo ne voit pas
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*)::int from public.patient_data_request),
  0,
  'Dirigeant Bravo ne voit aucune patient_data_request Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 6. CRITIQUE Pitfall 2 — audit_logs ne contient PAS request_token
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select not (metadata->'new') ? 'request_token'
     from public.audit_logs
     where action = 'patient_data_request.insert'
     limit 1),
  'audit_logs.metadata->new ne contient PAS request_token (Pitfall 2)'
);

-- -----------------------------------------------------------------------------
-- 7. CRITIQUE Pitfall 2 — audit_logs ne contient PAS proof_of_identity_url
-- -----------------------------------------------------------------------------
select ok(
  (select not (metadata->'new') ? 'requester_proof_of_identity_url'
     from public.audit_logs
     where action = 'patient_data_request.insert'
     limit 1),
  'audit_logs.metadata->new ne contient PAS requester_proof_of_identity_url'
);

-- -----------------------------------------------------------------------------
-- 8. CRITIQUE Pitfall 2 — la valeur du token n'apparaît nulle part en clair
-- dans audit_logs (cast metadata complet en text et grep)
-- -----------------------------------------------------------------------------
select ok(
  (select not exists(
     select 1 from public.audit_logs
       where action = 'patient_data_request.insert'
         and metadata::text like '%JWT_FACTICE_TOKEN_SECRET_NE_DOIT_PAS_LEAK%'
   )),
  'La valeur littérale du request_token ne fuite pas dans audit_logs.metadata'
);

select * from finish();
rollback;
