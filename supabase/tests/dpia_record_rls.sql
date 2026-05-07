-- =============================================================================
-- Tests RLS table dpia_record — Phase 1.5 DPA + RGPD compliance
-- D-07 (DPIA versionnée jsonb), D-16 (dirigeant only), D-18 (RLS forcée),
-- D-19 (audit trigger).
-- =============================================================================
-- État RED attendu en Wave 0 : la table public.dpia_record n'existe pas.
-- =============================================================================

begin;

select plan(7);

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
  (select relrowsecurity from pg_class where oid = 'public.dpia_record'::regclass),
  'RLS activée sur dpia_record'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.dpia_record'::regclass),
  'RLS forcée sur dpia_record'
);

-- -----------------------------------------------------------------------------
-- 3. Dirigeant Alpha peut INSERT une DPIA brouillon
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.dpia_record
       (organization_id, title, scope, risks_identified, mitigations,
        residual_risk_level, reviewed_at, next_review_at, status, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'Transport sanitaire patients ALD',
        'Traitement données santé patients dialysés',
        '[]'::jsonb, '[]'::jsonb, 'faible',
        '2026-05-07', '2027-05-07', 'brouillon',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'Dirigeant Alpha peut INSERT une dpia_record brouillon (D-16)'
);

-- -----------------------------------------------------------------------------
-- 4. D-16 : régulateur Alpha INSERT échoue 42501
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select throws_ok(
  $$ insert into public.dpia_record
       (organization_id, title, scope, residual_risk_level,
        reviewed_at, next_review_at, status, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Tentative régulateur',
        'Scope', 'faible', '2026-05-07', '2027-05-07', 'brouillon',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'Régulateur ne peut PAS INSERT dpia_record (D-16 dirigeant only)'
);

-- -----------------------------------------------------------------------------
-- 5. Status : transition brouillon -> validee permise au dirigeant
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ update public.dpia_record
       set status = 'validee'
       where organization_id = '11111111-1111-1111-1111-111111111111'
         and status = 'brouillon' $$,
  'Dirigeant Alpha peut faire transitionner DPIA brouillon -> validee'
);

-- -----------------------------------------------------------------------------
-- 6. Isolation tenant : Bravo ne voit pas
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*)::int from public.dpia_record),
  0,
  'Dirigeant Bravo ne voit aucune dpia_record Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 7. Audit log alimenté pour INSERT
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'dpia_record.insert'
         and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit dpia_record.insert (D-19)'
);

select * from finish();
rollback;
