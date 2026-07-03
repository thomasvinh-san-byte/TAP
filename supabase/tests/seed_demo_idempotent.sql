-- =============================================================================
-- Tests pgTAP — Idempotence seed démo rides (DEC-039-bis hotfix 2026-05-15)
-- =============================================================================
-- Couvre le bug fixé en hotfix DEC-039-bis : le seed démo ne resetait pas
-- TOUTES les colonnes runtime-mutables des rides au ré-application CD.
-- Conséquence avant fix : après UAT (démarrer/clôturer une course), la
-- ride avait un état hybride seed+runtime (started_at=null mais
-- ended_at=2026-... etc.) qui violait la contrainte CHECK
-- rides_ended_after_started lors du seed suivant.
--
-- Test : simule un cycle complet
--   1. INSERT initial seed (état frais : assignee, started_at=null,
--      ended_at=null, etc.)
--   2. UPDATE runtime UAT (démarrage + clôture)
--   3. RÉ-INSERT avec ON CONFLICT DO UPDATE exhaustif (équivalent CD
--      après hotfix)
--   4. Assertions : toutes les colonnes runtime-mutables sont revenues
--      à l'état seed frais.
--
-- Refs : DEC-039 (seed glissant), DEC-039-bis (DO UPDATE exhaustif),
--        hotfix CD violation rides_ended_after_started 2026-05-15.
-- =============================================================================

begin;

select plan(8);

-- -----------------------------------------------------------------------------
-- Fixtures : org Alpha + dirigeant + régulateur + patient + driver + ride
-- (toutes id prefixed '44444444-test-' pour ne pas collisionner avec
-- d'éventuelles rides seedées réelles)
-- -----------------------------------------------------------------------------
-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(); end $$;

insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'Hoarau', 'Patrick', '1980-01-23', '12 rue Pasteur',
   '97400', 'Saint-Denis', 'appel');

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.drivers
  (id, organization_id, profile_id, nom_affichage, type_permis, created_by)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '11111111-1111-1111-1111-111111111111',
   null, 'Vergoz Test', '{taxi}',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- -----------------------------------------------------------------------------
-- Étape 1 : INSERT initial du seed (état frais : assignee, pas démarrée)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

insert into public.rides (
  id, organization_id, patient_id, driver_id,
  pickup_address, dropoff_address,
  scheduled_at, status, transport_mode, urgency,
  started_at, tarif_source,
  created_at, created_by, updated_by
) values (
  '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999991',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '12 Rue de Paris, 97400 Saint-Denis',
  'CHU Félix Guyon, 97400 Saint-Denis',
  now() + interval '1 hour', 'assignee', 'taxi_conventionne', 'programmee',
  null, 'manuel',
  now(), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
         'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

select is(
  (select status::text from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'assignee',
  '1. Seed initial : status=assignee'
);

-- -----------------------------------------------------------------------------
-- Étape 2 : UPDATE runtime UAT — chauffeur démarre puis clôture
-- -----------------------------------------------------------------------------
update public.rides
   set status = 'en_cours',
       started_at = now()
 where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

update public.rides
   set status = 'terminee',
       ended_at = now() + interval '15 minutes',
       tarif_amount_eur = 25.50,
       tarif_source = 'manuel',
       payment_status = 'encaisse',
       payment_method = 'cash',
       payment_received_at = now() + interval '15 minutes'
 where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select status::text from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'terminee',
  '2. Post-UAT : status=terminee (workflow chauffeur complet)'
);

-- -----------------------------------------------------------------------------
-- Étape 3 : RE-INSERT seed avec ON CONFLICT DO UPDATE exhaustif (post-fix)
-- (équivalent du bloc J0 du seed démo après hotfix DEC-039-bis)
-- -----------------------------------------------------------------------------
insert into public.rides (
  id, organization_id, patient_id, driver_id,
  pickup_address, dropoff_address,
  scheduled_at, status, transport_mode, urgency,
  started_at, tarif_source,
  created_at, created_by, updated_by
) values (
  '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999991',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '12 Rue de Paris, 97400 Saint-Denis',
  'CHU Félix Guyon, 97400 Saint-Denis',
  now() + interval '1 hour', 'assignee', 'taxi_conventionne', 'programmee',
  null, 'manuel',
  now(), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
         'cccccccc-cccc-cccc-cccc-cccccccccccc'
)
on conflict (id) do update set
  scheduled_at = excluded.scheduled_at,
  created_at = excluded.created_at,
  pickup_address = excluded.pickup_address,
  dropoff_address = excluded.dropoff_address,
  transport_mode = excluded.transport_mode,
  urgency = excluded.urgency,
  driver_id = excluded.driver_id,
  status = excluded.status,
  started_at = excluded.started_at,
  ended_at = null,
  tarif_amount_eur = null,
  tarif_source = excluded.tarif_source,
  payment_status = 'non_concerne',
  payment_method = null,
  payment_received_at = null,
  archive = false,
  cancel_motif = null,
  notes_regulateur = null;

-- -----------------------------------------------------------------------------
-- Étape 4 : assertions reset complet
-- -----------------------------------------------------------------------------
select is(
  (select status::text from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'assignee',
  '3. Post re-seed : status reset à assignee'
);

select is(
  (select started_at from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null::timestamptz,
  '4. Post re-seed : started_at reset à null (bug initial)'
);

select is(
  (select ended_at from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null::timestamptz,
  '5. Post re-seed : ended_at reset à null (CORE FIX — corrige violation rides_ended_after_started)'
);

select is(
  (select tarif_amount_eur from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null::numeric,
  '6. Post re-seed : tarif_amount_eur reset à null'
);

select is(
  (select payment_status::text from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'non_concerne',
  '7. Post re-seed : payment_status reset à non_concerne'
);

select is(
  (select payment_method from public.rides
   where id = '44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null,
  '8. Post re-seed : payment_method reset à null'
);

select * from finish();
rollback;
