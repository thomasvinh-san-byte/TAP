-- =============================================================================
-- Tests RLS table dpa_record — Phase 1.5 DPA + RGPD compliance
-- D-06 (DPA Supabase + futurs sous-traitants), D-16 (dirigeant only),
-- D-18 (RLS forcée + organization_id), D-19 (audit trigger).
-- =============================================================================
-- État RED attendu en Wave 0 : la table public.dpa_record n'existe pas encore.
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
  (select relrowsecurity from pg_class where oid = 'public.dpa_record'::regclass),
  'RLS activée sur dpa_record'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.dpa_record'::regclass),
  'RLS forcée sur dpa_record'
);

-- -----------------------------------------------------------------------------
-- 3. Dirigeant Alpha peut INSERT un DPA Supabase
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.dpa_record
       (organization_id, subprocessor_name, subprocessor_role, dpa_version,
        dpa_document_url, signed_at, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Supabase', 'hebergement',
        'v2026-01-15', 'https://supabase.com/legal/dpa', '2026-01-15',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'Dirigeant Alpha peut INSERT un dpa_record (D-16)'
);

-- -----------------------------------------------------------------------------
-- 4. D-16 : régulateur Alpha INSERT échoue 42501
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select throws_ok(
  $$ insert into public.dpa_record
       (organization_id, subprocessor_name, subprocessor_role, dpa_version,
        signed_at, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Tentative', 'sms_provider',
        'v1', '2026-01-15', 'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'Régulateur ne peut PAS INSERT dpa_record (D-16 dirigeant only)'
);

-- -----------------------------------------------------------------------------
-- 5. Isolation tenant : Bravo ne voit pas les DPA Alpha
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*)::int from public.dpa_record),
  0,
  'Dirigeant Bravo ne voit aucun dpa_record Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 6. Bravo ne peut pas écrire dans Alpha
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.dpa_record
       (organization_id, subprocessor_name, subprocessor_role, dpa_version,
        signed_at, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Cross-tenant', 'hebergement',
        'v1', '2026-01-15', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501',
  null,
  'Dirigeant Bravo ne peut pas INSERT dans Alpha (RLS WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 7. Audit log alimenté
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'dpa_record.insert'
         and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit dpa_record.insert (D-19)'
);

select * from finish();
rollback;
