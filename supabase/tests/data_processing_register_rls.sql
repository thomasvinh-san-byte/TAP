-- =============================================================================
-- Tests RLS table data_processing_register — Phase 1.5 DPA + RGPD compliance
-- D-05 (versioning par lignes, pas d'UPDATE), D-16 (dirigeant only INSERT),
-- D-18 (RLS forcée + organization_id).
-- =============================================================================
-- État RED attendu en Wave 0 : la table public.data_processing_register
-- n'existe pas encore. Les assertions échouent jusqu'à la migration Wave 1.
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant Alpha + Bravo + dirigeant Alpha + régulateur Alpha
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
  (select relrowsecurity from pg_class where oid = 'public.data_processing_register'::regclass),
  'RLS activée sur data_processing_register'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.data_processing_register'::regclass),
  'RLS forcée sur data_processing_register (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. D-05 versioning : aucune policy UPDATE (chaque modif = nouvelle ligne)
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_policies
     where schemaname = 'public'
       and tablename = 'data_processing_register'
       and cmd = 'UPDATE'),
  0,
  'Aucune policy UPDATE sur data_processing_register (D-05 versioning par lignes)'
);

-- -----------------------------------------------------------------------------
-- 4. Dirigeant Alpha INSERT réussit
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.data_processing_register
       (organization_id, purpose, legal_basis, data_categories, data_subjects,
        recipients, retention_period_days, security_measures,
        international_transfer, created_by, updated_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Transport sanitaire patients',
        'contrat', array['identite','sante'], array['patient'],
        array['CGSS'], 1825, 'Chiffrement AES-256-GCM + RLS', false,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'Dirigeant Alpha peut INSERT un traitement (D-16)'
);

-- -----------------------------------------------------------------------------
-- 5. D-16 : régulateur Alpha INSERT échoue avec 42501 (dirigeant only)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select throws_ok(
  $$ insert into public.data_processing_register
       (organization_id, purpose, legal_basis, data_categories, data_subjects,
        recipients, retention_period_days, security_measures,
        international_transfer, created_by, updated_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Tentative régulateur',
        'contrat', array['identite'], array['patient'],
        array['CGSS'], 1825, 'TLS 1.3', false,
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'Régulateur ne peut PAS INSERT (D-16 dirigeant only)'
);

-- -----------------------------------------------------------------------------
-- 6-7. Isolation tenant : Bravo ne voit PAS les lignes Alpha
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*)::int from public.data_processing_register),
  0,
  'Dirigeant Bravo ne voit aucun traitement Alpha (isolation tenant)'
);

select throws_ok(
  $$ insert into public.data_processing_register
       (organization_id, purpose, legal_basis, data_categories, data_subjects,
        recipients, retention_period_days, security_measures,
        international_transfer, created_by, updated_by)
     values
       ('11111111-1111-1111-1111-111111111111', 'Cross-tenant',
        'contrat', array['identite'], array['patient'],
        array['CGSS'], 1825, 'TLS 1.3', false,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501',
  null,
  'Dirigeant Bravo ne peut pas INSERT dans Alpha (RLS WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 8. Audit log alimenté par trigger pour INSERT
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'data_processing_register.insert'
         and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit data_processing_register.insert (D-19 audit trigger)'
);

select * from finish();
rollback;
