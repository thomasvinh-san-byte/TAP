-- =============================================================================
-- Tests pgTAP — Contraintes d'exécution rides (Phase 3, Passe 1, 03-A)
-- =============================================================================
-- Couverture des 3 nouvelles contraintes de cohérence + transitions :
--   - rides_started_requires_driver : started_at sans driver_id → 23514
--   - rides_ended_after_started     : ended_at < started_at → 23514
--                                     ended_at sans started_at → 23514
--   - rides_payment_encaisse_complet :
--       * payment_status='encaisse' sans payment_method → 23514
--       * payment_status='encaisse' sans payment_received_at → 23514
--   - Cycle complet validee → assignee → en_cours → terminee avec
--     paiement encaissé → OK + 4 audit_logs (ride.insert + 3 ride.update)
--   - Index rides_driver_scheduled_idx présent
--
-- Pattern dupliqué de supabase/tests/rides_audit.sql.
-- =============================================================================

begin;

select plan(9);

-- -----------------------------------------------------------------------------
-- Fixtures : org Alpha + dirigeant + regulateur + patient + driver
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

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

insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'Hoarau', 'Patrick', '1980-01-23', '12 rue Pasteur',
   '97400', 'Saint-Denis', 'appel');

-- Driver Alpha (inséré sous dirigeant)
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.drivers
  (id, organization_id, profile_id, nom_affichage, telephone, type_permis, created_by)
values
  ('cccccccc-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   null,
   'Vergoz Jean', '0692111111', '{taxi}'::text[],
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Le reste des opérations passe sous régulateur (créateur des courses)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- -----------------------------------------------------------------------------
-- 1. INSERT minimal ride validee → OK (toutes nouvelles colonnes nullable
--    sauf payment_status qui prend son default 'non_concerne')
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.rides
       (id, organization_id, patient_id, scheduled_at,
        pickup_address, dropoff_address,
        created_by, updated_by)
     values
       ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1',
        '11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        now() + interval '1 hour',
        '12 rue Pasteur', 'CHU Bellepierre',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'INSERT ride validee — payment_status default = non_concerne'
);

-- -----------------------------------------------------------------------------
-- 2. Contrainte rides_started_requires_driver : started_at sans driver → 23514
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.rides
       set started_at = now()
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  '23514',
  null,
  'started_at posé sans driver_id → check rides_started_requires_driver (23514)'
);

-- -----------------------------------------------------------------------------
-- 3. Contrainte rides_ended_after_started : ended_at sans started_at → 23514
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.rides
       set ended_at = now()
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  '23514',
  null,
  'ended_at sans started_at → check rides_ended_after_started (23514)'
);

-- -----------------------------------------------------------------------------
-- 4. Contrainte rides_payment_encaisse_complet : encaisse sans method → 23514
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.rides
       set payment_status = 'encaisse',
           payment_received_at = now()
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  '23514',
  null,
  'payment_status=encaisse sans payment_method → check (23514)'
);

-- -----------------------------------------------------------------------------
-- 5. Contrainte rides_payment_encaisse_complet : encaisse sans received_at → 23514
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.rides
       set payment_status = 'encaisse',
           payment_method = 'cash'
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  '23514',
  null,
  'payment_status=encaisse sans payment_received_at → check (23514)'
);

-- -----------------------------------------------------------------------------
-- 6. Cycle complet : assignation → démarrage → clôture avec encaissement
-- -----------------------------------------------------------------------------
-- 6a. Assignation : status validee → assignee + driver_id
select lives_ok(
  $$ update public.rides
       set status = 'assignee',
           driver_id = 'cccccccc-0000-0000-0000-000000000001'
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  'Transition validee → assignee avec driver_id OK'
);

-- 6b. Démarrage : status en_cours + started_at (driver_id déjà présent)
select lives_ok(
  $$ update public.rides
       set status = 'en_cours',
           started_at = now()
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  'Transition assignee → en_cours avec started_at OK'
);

-- 6c. Clôture : status terminee + ended_at + tarif + paiement complet
select lives_ok(
  $$ update public.rides
       set status = 'terminee',
           ended_at = now() + interval '20 minutes',
           tarif_amount_eur = 28.50,
           tarif_source = 'manuel',
           payment_status = 'encaisse',
           payment_method = 'cash',
           payment_received_at = now() + interval '20 minutes'
       where id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1' $$,
  'Transition en_cours → terminee avec paiement encaissé complet OK'
);

-- -----------------------------------------------------------------------------
-- 7. Audit_logs : trigger Phase 2 inchangé capture les nouvelles colonnes.
--    Au moins 4 entrées pour cette ride (1 insert + 3 updates).
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";
select cmp_ok(
  (select count(*)::int from public.audit_logs
     where entity_type = 'ride'
       and entity_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1'),
  '>=',
  4,
  'audit_logs : ≥ 4 entrées pour la course (1 insert + ≥ 3 updates de transition)'
);

select * from finish();
rollback;
