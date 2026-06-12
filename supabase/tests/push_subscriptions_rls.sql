-- =============================================================================
-- Tests pgTAP — RLS push_subscriptions (notifications push PWA, DEC-167)
-- =============================================================================
-- Couverture (user-scoped strict, pattern notification_preferences) :
--   - RLS activée + forcée
--   - INSERT own OK / INSERT pour un autre user refusé (WITH CHECK)
--   - SELECT own uniquement (cross-user invisible)
--   - DELETE own OK (désabonnement)
--   - Grants : authenticated SELECT/INSERT/UPDATE/DELETE ; anon refusé
-- =============================================================================

begin;

select plan(9);

insert into public.organizations (id, nom, ville, code_postal)
values ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'chauf-a@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'chauf-b@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Chauf', 'A', 'chauf-a@test.tap'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Chauf', 'B', 'chauf-b@test.tap');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'RLS activée sur push_subscriptions'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'RLS forcée sur push_subscriptions'
);

set local role authenticated;

-- 3. chauf-a INSERT son propre abonnement OK
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.push_subscriptions
       (id, organization_id, user_id, endpoint, p256dh, auth)
     values ('99999999-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'https://push.example/a', 'p256-a', 'auth-a') $$,
  'chauf-a INSERT son abonnement OK'
);

-- 4. chauf-a INSERT pour chauf-b refusé (WITH CHECK user_id = auth.uid())
select throws_ok(
  $$ insert into public.push_subscriptions
       (organization_id, user_id, endpoint, p256dh, auth)
     values ('11111111-1111-1111-1111-111111111111',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       'https://push.example/b', 'p256-b', 'auth-b') $$,
  '42501', null,
  'chauf-a refusé INSERT pour un autre user'
);

-- 5. chauf-b INSERT son propre abonnement OK
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ insert into public.push_subscriptions
       (organization_id, user_id, endpoint, p256dh, auth)
     values ('11111111-1111-1111-1111-111111111111',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       'https://push.example/b', 'p256-b', 'auth-b') $$,
  'chauf-b INSERT son abonnement OK'
);

-- 6. chauf-b ne voit QUE son abonnement (pas celui de chauf-a)
select is(
  (select count(*)::int from public.push_subscriptions),
  1,
  'chauf-b ne voit que son propre abonnement (user-scoped)'
);

-- 7. chauf-a voit son abonnement (1)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.push_subscriptions),
  1,
  'chauf-a ne voit que son propre abonnement'
);

-- 8. chauf-a DELETE son abonnement OK (désabonnement)
select lives_ok(
  $$ delete from public.push_subscriptions
       where id = '99999999-0000-0000-0000-000000000001' $$,
  'chauf-a DELETE son abonnement OK'
);

-- 9. Grants
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT')
    and has_table_privilege('authenticated', 'public.push_subscriptions', 'INSERT')
    and has_table_privilege('authenticated', 'public.push_subscriptions', 'UPDATE')
    and has_table_privilege('authenticated', 'public.push_subscriptions', 'DELETE')
    and not has_table_privilege('anon', 'public.push_subscriptions', 'SELECT'),
  'Grants : authenticated SELECT/INSERT/UPDATE/DELETE ; anon refusé'
);

select * from finish();
rollback;
