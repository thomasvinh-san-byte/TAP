-- =============================================================================
-- Tests pgTAP — Idempotence seed démo « facturation » (SEED-01)
-- =============================================================================
-- Couvre les deux comportements introduits par SEED-01 :
--   A. Les courses « facturation » réinitialisent leurs champs de paiement vers
--      la BASELINE SEED (excluded.*), pas vers le défaut table — la dérive UAT
--      est effacée sans état hybride (esprit DEC-039-bis étendu au paiement).
--   B. Le compteur trigger-owned d'une prescription (trajets_consommes) reste
--      COHÉRENT au ré-seed : la prescription ne réinitialise PAS ce compteur
--      (piloté par rides_prescription_counter), et le reset du statut de la
--      course rejoue le trigger de façon symétrique → valeur stable.
--
-- Cycle simulé : seed initial → modification runtime UAT (annulation +
-- changement de mode de paiement) → ré-seed exhaustif → assertions.
-- =============================================================================

begin;

select plan(4);

-- -----------------------------------------------------------------------------
-- Fixtures : org + dirigeant + régulateur + patient + driver + prescripteur
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values ('77777777-7777-7777-7777-777777777777', 'Org Facturation', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('77770000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'fact-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('77770000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'fact-reg@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('77770000-0000-0000-0000-0000000000d1', '77777777-7777-7777-7777-777777777777',
   'dirigeant', 'Fact', 'Dirigeant', 'fact-dir@test.tap'),
  ('77770000-0000-0000-0000-0000000000c1', '77777777-7777-7777-7777-777777777777',
   'regulateur', 'Fact', 'Régulateur', 'fact-reg@test.tap');

insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('77779999-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
   'Payet', 'Georges', '1955-06-12', '45 Avenue de la République',
   '97410', 'Saint-Pierre', 'appel');

set local role authenticated;
set local "request.jwt.claim.sub" = '77770000-0000-0000-0000-0000000000d1';

insert into public.drivers
  (id, organization_id, profile_id, nom_affichage, type_permis, created_by)
values
  ('77770000-0000-0000-0000-0000000000e1', '77777777-7777-7777-7777-777777777777',
   null, 'Maillot Test', '{taxi}', '77770000-0000-0000-0000-0000000000d1');

set local "request.jwt.claim.sub" = '77770000-0000-0000-0000-0000000000c1';

insert into public.prescribers
  (id, organization_id, nom, type, finess, created_by)
values
  ('77770000-0000-0000-0000-0000000000f1', '77777777-7777-7777-7777-777777777777',
   'CHU Démo Facturation', 'etablissement', '970000009',
   '77770000-0000-0000-0000-0000000000c1');

-- -----------------------------------------------------------------------------
-- Étape 1 : seed initial — prescription (10 trajets) + 1 course consommatrice
-- -----------------------------------------------------------------------------
insert into public.prescriptions
  (id, organization_id, patient_id, prescriber_id, numero, date_prescription,
   trajets_autorises, date_expiration, statut, created_by)
values
  ('77776666-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
   '77779999-0000-0000-0000-000000000001', '77770000-0000-0000-0000-0000000000f1',
   'BT-TEST-0001', current_date - 10, 10, current_date + 90, 'active',
   '77770000-0000-0000-0000-0000000000c1');

insert into public.rides (
  id, organization_id, patient_id, driver_id, prescription_id,
  pickup_address, dropoff_address,
  scheduled_at, status, transport_mode, urgency,
  started_at, ended_at, tarif_amount_eur, tarif_source,
  payment_status, payment_method, payment_received_at,
  created_at, created_by, updated_by
) values (
  '77774444-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
  '77779999-0000-0000-0000-000000000001', '77770000-0000-0000-0000-0000000000e1',
  '77776666-0000-0000-0000-000000000001',
  '45 Avenue de la République, 97410 Saint-Pierre',
  'Centre de dialyse Sud, 97410 Saint-Pierre',
  now() - interval '2 hours', 'terminee', 'taxi_conventionne', 'programmee',
  now() - interval '2 hours', now() - interval '90 minutes',
  28.00, 'manuel', 'encaisse', 'cheque', now() - interval '90 minutes',
  now() - interval '2 hours', '77770000-0000-0000-0000-0000000000c1',
  '77770000-0000-0000-0000-0000000000c1'
);

select is(
  (select trajets_consommes from public.prescriptions
   where id = '77776666-0000-0000-0000-000000000001'),
  1,
  '1. Seed initial : compteur prescription = 1 (course consommatrice rattachée)'
);

-- -----------------------------------------------------------------------------
-- Étape 2 : modification runtime UAT — annulation + changement de paiement
-- -----------------------------------------------------------------------------
update public.rides
   set status = 'annulee_regulateur',
       payment_status = 'encaisse',
       payment_method = 'cash',
       cancel_motif = 'Annulation test'
 where id = '77774444-0000-0000-0000-000000000001';

select is(
  (select trajets_consommes from public.prescriptions
   where id = '77776666-0000-0000-0000-000000000001'),
  0,
  '2. Post-UAT : compteur décrémenté à 0 (course annulée = non consommatrice)'
);

-- -----------------------------------------------------------------------------
-- Étape 3 : ré-seed exhaustif (prescription statique + course excluded.*)
-- -----------------------------------------------------------------------------
insert into public.prescriptions
  (id, organization_id, patient_id, prescriber_id, numero, date_prescription,
   trajets_autorises, date_expiration, statut, created_by)
values
  ('77776666-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
   '77779999-0000-0000-0000-000000000001', '77770000-0000-0000-0000-0000000000f1',
   'BT-TEST-0001', current_date - 10, 10, current_date + 90, 'active',
   '77770000-0000-0000-0000-0000000000c1')
on conflict (id) do update set
  numero = excluded.numero,
  date_prescription = excluded.date_prescription,
  trajets_autorises = excluded.trajets_autorises,
  date_expiration = excluded.date_expiration;
  -- trajets_consommes / statut NON réinitialisés (pilotés par le trigger).

insert into public.rides (
  id, organization_id, patient_id, driver_id, prescription_id,
  pickup_address, dropoff_address,
  scheduled_at, status, transport_mode, urgency,
  started_at, ended_at, tarif_amount_eur, tarif_source,
  payment_status, payment_method, payment_received_at,
  created_at, created_by, updated_by
) values (
  '77774444-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
  '77779999-0000-0000-0000-000000000001', '77770000-0000-0000-0000-0000000000e1',
  '77776666-0000-0000-0000-000000000001',
  '45 Avenue de la République, 97410 Saint-Pierre',
  'Centre de dialyse Sud, 97410 Saint-Pierre',
  now() - interval '2 hours', 'terminee', 'taxi_conventionne', 'programmee',
  now() - interval '2 hours', now() - interval '90 minutes',
  28.00, 'manuel', 'encaisse', 'cheque', now() - interval '90 minutes',
  now() - interval '2 hours', '77770000-0000-0000-0000-0000000000c1',
  '77770000-0000-0000-0000-0000000000c1'
)
on conflict (id) do update set
  status = excluded.status,
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  tarif_amount_eur = excluded.tarif_amount_eur,
  payment_status = excluded.payment_status,
  payment_method = excluded.payment_method,
  payment_received_at = excluded.payment_received_at,
  cancel_motif = null;

-- -----------------------------------------------------------------------------
-- Étape 4 : assertions — baseline paiement restaurée + compteur cohérent
-- -----------------------------------------------------------------------------
select is(
  (select payment_method from public.rides
   where id = '77774444-0000-0000-0000-000000000001'),
  'cheque',
  '3. Post ré-seed : payment_method réinitialisé à la BASELINE SEED (cheque), pas au défaut null'
);

select is(
  (select trajets_consommes from public.prescriptions
   where id = '77776666-0000-0000-0000-000000000001'),
  1,
  '4. Post ré-seed : compteur prescription recohérent à 1 (course reterminée, trigger symétrique)'
);

select * from finish();
rollback;
