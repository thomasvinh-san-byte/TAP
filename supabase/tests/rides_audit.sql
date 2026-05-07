-- =============================================================================
-- Tests pgTAP — Audit trigger rides (Phase 2, Plan 02-02, Wave 1 GREEN)
-- =============================================================================
-- Couverture (T-02-T3 — D-10 audit bypass impossible) :
--   - INSERT public.rides → audit_logs.action = 'ride.insert'
--   - metadata->'new' contient patient_id
--   - actor_role = 'regulateur' correctement renseigné par current_user_role()
--   - UPDATE public.rides → audit_logs.action = 'ride.update'
--   - metadata->'old' présent en UPDATE
--   - INSERT public.ride_draft → AUCUN audit_log (D-10 transitoire)
--
-- Pattern dupliqué de supabase/tests/patients.sql lignes 195-218.
-- =============================================================================

begin;

select plan(6);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant + 1 patient Alpha pour FK
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
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

-- -----------------------------------------------------------------------------
-- 1. INSERT ride → audit_logs ride.insert
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

insert into public.rides
  (organization_id, patient_id, scheduled_at,
   pickup_address, dropoff_address,
   created_by, updated_by)
values
  ('11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   now() + interval '1 day',
   '12 rue Pasteur', 'CHU Bellepierre',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- Lecture audit_logs : les policies SELECT exigent rôle dirigeant. On RESET
-- pour valider depuis service_role / pg_role default (postgres) qui bypass RLS.
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
      where action = 'ride.insert'
        and entity_type = 'ride'
        and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit une ligne action=ride.insert après INSERT public.rides'
);

-- -----------------------------------------------------------------------------
-- 2. metadata->'new' contient patient_id
-- -----------------------------------------------------------------------------
select ok(
  (select (metadata->'new') ? 'patient_id'
     from public.audit_logs
     where action = 'ride.insert'
     order by created_at desc limit 1),
  'audit_logs.metadata->new contient patient_id'
);

-- -----------------------------------------------------------------------------
-- 3. actor_role = 'regulateur' (current_user_role() correctement résolu)
-- -----------------------------------------------------------------------------
select is(
  (select actor_role::text from public.audit_logs
     where action = 'ride.insert'
     order by created_at desc limit 1),
  'regulateur',
  'actor_role = regulateur (résolu par current_user_role())'
);

-- -----------------------------------------------------------------------------
-- 4. UPDATE rides → audit_logs ride.update
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

update public.rides
  set notes_regulateur = 'note de test'
  where id = (select id from public.rides limit 1);

reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
      where action = 'ride.update'
        and entity_type = 'ride'
   )),
  'audit_logs reçoit ride.update après UPDATE'
);

-- -----------------------------------------------------------------------------
-- 5. metadata->'old' présent en UPDATE (delta complet)
-- -----------------------------------------------------------------------------
select ok(
  (select (metadata ? 'old') and (metadata->'old') is not null
     and (metadata->'old') != 'null'::jsonb
     from public.audit_logs
     where action = 'ride.update'
     order by created_at desc limit 1),
  'audit_logs.metadata.old présent et non-null sur UPDATE'
);

-- -----------------------------------------------------------------------------
-- 6. INSERT ride_draft → AUCUN audit_log (D-10 — donnée transitoire)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

insert into public.ride_draft
  (organization_id, author_id, payload)
values
  ('11111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '{}'::jsonb);

reset role;
reset "request.jwt.claim.sub";

select is(
  (select count(*)::int from public.audit_logs
     where entity_type = 'ride_draft' or action like 'ride_draft%'),
  0,
  'aucun audit_log généré pour ride_draft (D-10 — donnée transitoire)'
);

select * from finish();
rollback;
