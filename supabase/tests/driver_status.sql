-- =============================================================================
-- Tests pgTAP — Statut chauffeur (driver_status) — CHAUFFEUR-01, §5.6
-- =============================================================================
-- Couverture :
--   - colonne status présente, défaut 'actif'
--   - trigger de dérivation : status pilote actif/archive (source unique)
--   - status='suspendu'/'conge' → actif=false, archive=false (non archivé)
--   - garde-fou : régulateur ne peut PAS passer status='archive' (42501)
--   - dirigeant peut archiver via status='archive' → archive=true, actif=false
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures : Org Alpha + dirigeant + régulateur + 1 chauffeur
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

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
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap');

insert into public.drivers (id, organization_id, nom_affichage, created_by)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Vergoz Jean',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- -----------------------------------------------------------------------------
-- 1. La colonne status existe
-- -----------------------------------------------------------------------------
select has_column('public', 'drivers', 'status', 'drivers.status existe');

-- -----------------------------------------------------------------------------
-- 2. Défaut 'actif' + dérivation à l'INSERT (actif=true, archive=false)
-- -----------------------------------------------------------------------------
select is(
  (select status::text || '|' || actif::text || '|' || archive::text
     from public.drivers where id = 'cccccccc-0000-0000-0000-000000000001'),
  'actif|true|false',
  'INSERT sans status → status=actif, actif=true, archive=false (dérivation)'
);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- -----------------------------------------------------------------------------
-- 3. status='suspendu' → actif=false, archive=false (non archivé)
-- -----------------------------------------------------------------------------
update public.drivers set status = 'suspendu'
  where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select actif::text || '|' || archive::text
     from public.drivers where id = 'cccccccc-0000-0000-0000-000000000001'),
  'false|false',
  'status=suspendu → actif=false, archive=false'
);

-- -----------------------------------------------------------------------------
-- 4. status='conge' → actif=false, archive=false
-- -----------------------------------------------------------------------------
update public.drivers set status = 'conge'
  where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select actif::text || '|' || archive::text
     from public.drivers where id = 'cccccccc-0000-0000-0000-000000000001'),
  'false|false',
  'status=conge → actif=false, archive=false'
);

-- -----------------------------------------------------------------------------
-- 5. Réactivation status='actif' → actif=true
-- -----------------------------------------------------------------------------
update public.drivers set status = 'actif'
  where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select actif from public.drivers where id = 'cccccccc-0000-0000-0000-000000000001'),
  true,
  'status=actif → actif=true (réactivation)'
);

-- -----------------------------------------------------------------------------
-- 6. Régulateur ne peut PAS archiver via status='archive' (garde-fou 42501)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$ update public.drivers set status = 'archive'
       where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'Régulateur ne peut pas passer un chauffeur en archive (garde-fou dirigeant)'
);

-- -----------------------------------------------------------------------------
-- 7. Dirigeant peut archiver via status='archive'
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ update public.drivers set status = 'archive'
       where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'Dirigeant peut archiver via status=archive'
);

-- -----------------------------------------------------------------------------
-- 8. Après archivage : archive=true, actif=false (dérivation)
-- -----------------------------------------------------------------------------
select is(
  (select actif::text || '|' || archive::text
     from public.drivers where id = 'cccccccc-0000-0000-0000-000000000001'),
  'false|true',
  'status=archive → actif=false, archive=true'
);

select * from finish();
rollback;
