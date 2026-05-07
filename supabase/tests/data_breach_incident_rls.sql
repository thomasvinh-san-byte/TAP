-- =============================================================================
-- Tests RLS table data_breach_incident — Phase 1.5 DPA + RGPD compliance
-- D-08 (tracker violation 72h), D-16 (dirigeant only INSERT), D-18 (RLS forcée),
-- D-19 (audit trigger).
-- =============================================================================
-- État RED attendu en Wave 0 : la table public.data_breach_incident n'existe
-- pas encore.
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
  (select relrowsecurity from pg_class where oid = 'public.data_breach_incident'::regclass),
  'RLS activée sur data_breach_incident'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.data_breach_incident'::regclass),
  'RLS forcée sur data_breach_incident'
);

-- -----------------------------------------------------------------------------
-- 3. Dirigeant Alpha peut INSERT un incident
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.data_breach_incident
       (organization_id, detected_at, severity, nature,
        affected_data_categories, description, immediate_measures,
        cnil_notification_required, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', now() - interval '1 hour',
        'eleve', 'confidentialite',
        array['identite','sante'],
        'Accès non autorisé via session compromise',
        'Révocation des sessions actives + reset MFA',
        true,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'Dirigeant Alpha peut INSERT un data_breach_incident (D-16)'
);

-- -----------------------------------------------------------------------------
-- 4. D-16 : régulateur Alpha INSERT échoue 42501
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select throws_ok(
  $$ insert into public.data_breach_incident
       (organization_id, detected_at, severity, nature,
        affected_data_categories, description, immediate_measures,
        cnil_notification_required, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', now(),
        'faible', 'integrite', array['identite'],
        'Tentative régulateur', 'Aucune', false,
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'Régulateur ne peut PAS INSERT data_breach_incident (D-16 dirigeant only)'
);

-- -----------------------------------------------------------------------------
-- 5. Isolation tenant : Bravo ne voit pas
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*)::int from public.data_breach_incident),
  0,
  'Dirigeant Bravo ne voit aucun data_breach_incident Alpha (isolation tenant)'
);

-- -----------------------------------------------------------------------------
-- 6. Bravo ne peut pas écrire dans Alpha (cross-tenant denied)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.data_breach_incident
       (organization_id, detected_at, severity, nature,
        affected_data_categories, description, immediate_measures,
        cnil_notification_required, created_by)
     values
       ('11111111-1111-1111-1111-111111111111', now(),
        'faible', 'integrite', array['identite'],
        'Cross-tenant', 'Aucune', false,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501',
  null,
  'Dirigeant Bravo ne peut pas INSERT dans Alpha'
);

-- -----------------------------------------------------------------------------
-- 7. Audit log alimenté pour INSERT
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'data_breach_incident.insert'
         and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit data_breach_incident.insert (D-19)'
);

select * from finish();
rollback;
