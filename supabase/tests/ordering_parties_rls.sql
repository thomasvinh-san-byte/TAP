-- =============================================================================
-- Tests pgTAP — RLS ordering_parties (donneurs d'ordres B2B, DEC-148)
-- =============================================================================
-- Couverture (calquée sur drivers_rls.sql) :
--   - RLS activée + forcée sur public.ordering_parties
--   - SELECT same-org / cross-org strict (cross-tenant)
--   - INSERT dirigeant OK / régulateur refusé / chauffeur refusé
--   - SELECT visible au régulateur same-org (rattachement de course)
--   - INSERT cross-org refusé (WITH CHECK organization_id)
--   - UPDATE dirigeant OK / régulateur filtré par USING (0 ligne)
--   - DELETE refusé pour tous (pas de policy DELETE)
--   - Audit log écrit sur INSERT + UPDATE (action ordering_party.*)
--   - Grants authenticated (SELECT/INSERT/UPDATE) ; anon refusé
--
-- Pattern dupliqué de supabase/tests/drivers_rls.sql.
-- =============================================================================

begin;

select plan(13);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant : Org Alpha + Org Bravo + 4 users (3 rôles Alpha + reg Bravo)
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
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-chauffeur@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
   'chauffeur', 'Alpha', 'Chauffeur', 'alpha-chauffeur@test.tap');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ordering_parties'::regclass),
  'RLS activée sur ordering_parties'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.ordering_parties'::regclass),
  'RLS forcée sur ordering_parties (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. alpha-dir INSERT (dirigeant autorisé) — siret NULL accepté
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.ordering_parties
       (id, organization_id, raison_sociale, siret, modalite_facturation, created_by)
     values
       ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'Centre Hospitalier Alpha', null, 'mensuelle',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'alpha-dir INSERT ordering_party OK (siret NULL accepté)'
);

-- -----------------------------------------------------------------------------
-- 4. alpha-reg INSERT refusé (régulateur n'est pas dirigeant)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ insert into public.ordering_parties
       (organization_id, raison_sociale, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'Clinique Régulateur',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501',
  null,
  'alpha-reg refusé INSERT ordering_party (rôle non dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 5. alpha-chauffeur INSERT refusé
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select throws_ok(
  $$ insert into public.ordering_parties
       (organization_id, raison_sociale, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'EHPAD Chauffeur',
        'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  '42501',
  null,
  'alpha-chauffeur refusé INSERT ordering_party (rôle non dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 6. alpha-reg SELECT voit les donneurs d'ordres same-org (rattachement course)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select count(*)::int from public.ordering_parties),
  1,
  'alpha-reg voit le donneur d''ordres Alpha via SELECT same_org'
);

-- -----------------------------------------------------------------------------
-- 7. bravo-dir ne voit pas les donneurs d'ordres Alpha (cross-tenant strict)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.ordering_parties),
  0,
  'bravo-dir ne voit aucun donneur d''ordres Alpha (cross-tenant strict)'
);

-- -----------------------------------------------------------------------------
-- 8. bravo-dir refusé INSERT cross-org dans Alpha (WITH CHECK)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.ordering_parties
       (organization_id, raison_sociale, created_by)
     values
       ('11111111-1111-1111-1111-111111111111',
        'Intrusion Bravo',
        'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  '42501',
  null,
  'bravo-dir refusé INSERT cross-org (WITH CHECK organization_id)'
);

-- -----------------------------------------------------------------------------
-- 9. alpha-dir UPDATE OK
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ update public.ordering_parties
       set actif = false
       where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'alpha-dir UPDATE ordering_party OK'
);

-- -----------------------------------------------------------------------------
-- 10. alpha-reg UPDATE refusé (filtré par USING → 0 ligne affectée)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select count(*)::int
     from (
       update public.ordering_parties
         set contact_principal_telephone = '0262999999'
         where id = 'cccccccc-0000-0000-0000-000000000001'
         returning 1
     ) as t),
  0,
  'alpha-reg UPDATE ordering_party filtré par USING (0 ligne affectée)'
);

-- -----------------------------------------------------------------------------
-- 11. DELETE refusé pour tous (pas de policy DELETE)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$ delete from public.ordering_parties
       where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'DELETE ordering_party refusé (archivage logique uniquement)'
);

-- -----------------------------------------------------------------------------
-- 12. Audit log ordering_party.insert + ordering_party.update présents
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select ok(
  (select
     bool_and(action_present)
     from (
       select exists(
         select 1 from public.audit_logs
          where action = 'ordering_party.insert'
            and entity_type = 'ordering_party'
            and organization_id = '11111111-1111-1111-1111-111111111111'
       ) as action_present
       union all
       select exists(
         select 1 from public.audit_logs
          where action = 'ordering_party.update'
            and entity_type = 'ordering_party'
            and organization_id = '11111111-1111-1111-1111-111111111111'
       )
     ) as t),
  'audit_logs reçoit ordering_party.insert ET ordering_party.update'
);

-- -----------------------------------------------------------------------------
-- 13. Grants : authenticated SELECT/INSERT/UPDATE OK ; pas de DELETE ; anon refusé
-- -----------------------------------------------------------------------------
select ok(
  has_table_privilege('authenticated', 'public.ordering_parties', 'SELECT')
    and has_table_privilege('authenticated', 'public.ordering_parties', 'INSERT')
    and has_table_privilege('authenticated', 'public.ordering_parties', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ordering_parties', 'DELETE')
    and not has_table_privilege('anon', 'public.ordering_parties', 'SELECT'),
  'Grants ordering_parties : authenticated SELECT/INSERT/UPDATE OK ; DELETE refusé ; anon refusé'
);

select * from finish();
rollback;
