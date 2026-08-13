-- =============================================================================
-- Tests pgTAP — RLS ride_draft (Phase 2, Plan 02-02, Wave 1 GREEN)
-- =============================================================================
-- Couverture (T-02-T2 — Pitfall 4 RESEARCH author_id scoping strict) :
--   - RLS activée + forcée sur public.ride_draft
--   - reg1 crée son brouillon, le voit
--   - reg2 (MÊME ORG) ne voit PAS le brouillon de reg1 (author_id scope)
--   - reg2 ne peut PAS INSERT en spoofant author_id de reg1 (WITH CHECK)
--   - bravo-reg cross-tenant : 0 access
--   - PAS de trigger d'audit sur ride_draft (D-10 — donnée transitoire)
--
-- Fixture étendue : ajout alpha-reg2 'eeeeeeee-...' dans org Alpha.
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant + 2 régulateurs MÊME ORG (reg1 + reg2 Alpha)
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('e0e00006-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg2@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur1', 'alpha-reg@test.tap'),
  ('e0e00006-e0e0-e0e0-e0e0-e0e0e0e0e0e0', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur2', 'alpha-reg2@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'regulateur', 'Bravo', 'Régulateur', 'bravo-reg@test.tap');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ride_draft'::regclass),
  'RLS activée sur ride_draft'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.ride_draft'::regclass),
  'RLS forcée sur ride_draft (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-reg1 crée un brouillon
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ insert into public.ride_draft
       (organization_id, author_id, payload)
     values
       ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '{"pickup_address": "12 rue Pasteur"}'::jsonb) $$,
  'alpha-reg1 crée son brouillon (author_id = auth.uid())'
);

-- -----------------------------------------------------------------------------
-- 4. alpha-reg1 voit son brouillon
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.ride_draft),
  1,
  'alpha-reg1 voit son propre brouillon (1 ligne)'
);

-- -----------------------------------------------------------------------------
-- 5. alpha-reg2 (MÊME ORG) ne voit PAS le brouillon de reg1
--    (Pitfall 4 RESEARCH — author_id scoping strict)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'e0e00006-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
select is(
  (select count(*)::int from public.ride_draft),
  0,
  'alpha-reg2 (même org) ne voit AUCUN brouillon de reg1 (author_id scope)'
);

-- -----------------------------------------------------------------------------
-- 6. alpha-reg2 ne peut PAS INSERT en spoofant author_id = reg1
--    (WITH CHECK author_id = auth.uid())
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.ride_draft
       (organization_id, author_id, payload)
     values
       ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '{}'::jsonb) $$,
  '42501',
  null,
  'alpha-reg2 ne peut INSERT en spoofant author_id = reg1 (WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 7. bravo-reg cross-tenant : 0 access (paranoïa multi-tenant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.ride_draft),
  0,
  'bravo-reg ne voit aucun brouillon Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 8. PAS de trigger d'audit sur ride_draft (D-10 — donnée transitoire)
--    On vérifie qu'aucun trigger ne porte le nom *audit* sur ride_draft.
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select is(
  (select count(*)::int from pg_trigger
     where tgrelid = 'public.ride_draft'::regclass
       and tgname like '%audit%'
       and not tgisinternal),
  0,
  'aucun trigger d''audit sur ride_draft (D-10 transitoire)'
);

select * from finish();
rollback;
