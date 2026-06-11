-- =============================================================================
-- Tests pgTAP — RLS notification_preferences (préférences user-scoped, DEC-149)
-- =============================================================================
-- Couverture (RLS user-scoped strict, pattern ride_draft) :
--   - RLS activée + forcée sur public.notification_preferences
--   - reg1 upsert sa ligne, la voit (1 ligne)
--   - reg2 (MÊME ORG) ne voit PAS la ligne de reg1 (user_id scope)
--   - reg2 ne peut PAS INSERT en spoofant user_id de reg1 (WITH CHECK)
--   - reg1 UPDATE sa propre ligne OK
--   - bravo-reg cross-tenant : 0 access
--   - Grants : authenticated SELECT/INSERT/UPDATE ; DELETE refusé ; anon refusé
-- =============================================================================

begin;

select plan(9);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant + 2 régulateurs MÊME ORG (reg1 + reg2 Alpha) + Bravo
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
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
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
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur2', 'alpha-reg2@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'regulateur', 'Bravo', 'Régulateur', 'bravo-reg@test.tap');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass),
  'RLS activée sur notification_preferences'
);
select ok(
  (select relforcerowsecurity
     from pg_class where oid = 'public.notification_preferences'::regclass),
  'RLS forcée sur notification_preferences (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. reg1 INSERT sa ligne (user_id = self) OK
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.notification_preferences
       (user_id, organization_id, alert_ride_delayed)
     values
       ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111', false) $$,
  'reg1 INSERT sa propre préférence OK'
);

-- -----------------------------------------------------------------------------
-- 4. reg1 voit sa ligne
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.notification_preferences),
  1,
  'reg1 voit sa propre préférence'
);

-- -----------------------------------------------------------------------------
-- 5. reg2 (même org) ne voit PAS la ligne de reg1 (user_id scope strict)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select is(
  (select count(*)::int from public.notification_preferences),
  0,
  'reg2 (même org) ne voit AUCUNE préférence de reg1 (user_id scope)'
);

-- -----------------------------------------------------------------------------
-- 6. reg2 ne peut PAS INSERT en spoofant le user_id de reg1 (WITH CHECK)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.notification_preferences
       (user_id, organization_id)
     values
       ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'reg2 refusé INSERT en spoofant user_id de reg1 (WITH CHECK user_id = auth.uid())'
);

-- -----------------------------------------------------------------------------
-- 7. reg1 UPDATE sa propre ligne OK
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ update public.notification_preferences
       set alert_ride_delayed = true
       where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  'reg1 UPDATE sa propre préférence OK'
);

-- -----------------------------------------------------------------------------
-- 8. bravo-reg cross-tenant : 0 access
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.notification_preferences),
  0,
  'bravo-reg ne voit aucune préférence (cross-tenant + user scope)'
);

-- -----------------------------------------------------------------------------
-- 9. Grants : authenticated SELECT/INSERT/UPDATE OK ; DELETE refusé ; anon refusé
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.notification_preferences', 'SELECT')
    and has_table_privilege('authenticated', 'public.notification_preferences', 'INSERT')
    and has_table_privilege('authenticated', 'public.notification_preferences', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.notification_preferences', 'DELETE')
    and not has_table_privilege('anon', 'public.notification_preferences', 'SELECT'),
  'Grants notification_preferences : authenticated SELECT/INSERT/UPDATE ; DELETE refusé ; anon refusé'
);

select * from finish();
rollback;
