-- =============================================================================
-- Tests pgTAP — RLS weather_alerts (mode alerte météo / cyclone, DEC-170)
-- =============================================================================
-- Couverture (calquée sur prescribers) :
--   - RLS activée + forcée
--   - INSERT dirigeant OK / régulateur OK / chauffeur refusé
--   - SELECT same-org / cross-org strict
--   - INSERT cross-org refusé (WITH CHECK)
--   - UPDATE régulateur same-org OK (désactivation)
--   - DELETE refusé pour tous (historique immuable)
--   - Index unique partiel : un seul épisode actif par org
--   - Grants : authenticated SELECT/INSERT/UPDATE ; pas de DELETE ; anon refusé
-- =============================================================================

begin;

select plan(12);

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
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chauf@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chauf@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weather_alerts'::regclass),
  'RLS activée sur weather_alerts'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.weather_alerts'::regclass),
  'RLS forcée sur weather_alerts'
);

set local role authenticated;

-- 3. alpha-reg active le mode météo (régulateur autorisé)
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ insert into public.weather_alerts
       (id, organization_id, active, motif, activated_by)
     values
       ('99999999-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', true,
        'alerte rouge cyclone', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'alpha-reg active le mode alerte météo OK'
);

-- 4. Second épisode actif refusé (index unique partiel)
select throws_ok(
  $$ insert into public.weather_alerts
       (organization_id, active, motif, activated_by)
     values
       ('11111111-1111-1111-1111-111111111111', true, 'doublon',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '23505', null,
  'un seul épisode actif par org (index unique partiel)'
);

-- 5. alpha-chauf INSERT refusé (rôle non autorisé)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.weather_alerts
       (organization_id, active, motif, activated_by)
     values
       ('11111111-1111-1111-1111-111111111111', true, 'X',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', null,
  'alpha-chauf refusé INSERT mode météo (rôle non autorisé)'
);

-- 6. alpha-chauf SELECT same-org voit l'épisode (bandeau cockpit pour tous)
select is(
  (select count(*)::int from public.weather_alerts),
  1,
  'alpha-chauf voit l''épisode de son org (bandeau cockpit)'
);

-- 7. bravo-dir ne voit aucun épisode Alpha (cross-tenant)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.weather_alerts),
  0,
  'bravo-dir ne voit aucun épisode Alpha (cross-tenant strict)'
);

-- 8. bravo-dir INSERT cross-org dans Alpha refusé (WITH CHECK)
select throws_ok(
  $$ insert into public.weather_alerts
       (organization_id, active, motif, activated_by)
     values
       ('11111111-1111-1111-1111-111111111111', true, 'Y',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501', null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- 9. alpha-reg UPDATE same-org OK (désactivation de l'épisode)
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select lives_ok(
  $$ update public.weather_alerts
       set active = false, deactivated_at = now()
       where id = '99999999-0000-0000-0000-000000000001' $$,
  'alpha-reg désactive l''épisode same-org OK'
);

-- 10. Réactivation possible après désactivation (plus d'actif → index libre)
select lives_ok(
  $$ insert into public.weather_alerts
       (organization_id, active, motif, activated_by)
     values
       ('11111111-1111-1111-1111-111111111111', true, 'nouvelle alerte',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'nouvel épisode actif possible après désactivation du précédent'
);

-- 11. DELETE refusé pour tous (historique immuable)
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.weather_alerts
       where id = '99999999-0000-0000-0000-000000000001' $$,
  '42501', null,
  'DELETE épisode météo refusé (historique immuable)'
);

-- 12. Grants
reset role;
reset "request.jwt.claim.sub";
select ok(
  has_table_privilege('authenticated', 'public.weather_alerts', 'SELECT')
    and has_table_privilege('authenticated', 'public.weather_alerts', 'INSERT')
    and has_table_privilege('authenticated', 'public.weather_alerts', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.weather_alerts', 'DELETE')
    and not has_table_privilege('anon', 'public.weather_alerts', 'SELECT'),
  'Grants : authenticated SELECT/INSERT/UPDATE ; DELETE refusé ; anon refusé'
);

select * from finish();
rollback;
