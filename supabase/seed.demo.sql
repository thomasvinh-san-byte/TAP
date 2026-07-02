-- =============================================================================
-- Seed démo additionnel — Données réalistes 974 (preview / staging UNIQUEMENT)
-- =============================================================================
-- Applique APRÈS supabase/seed.sql. Ne contient AUCUNE donnée réelle :
--   • Noms réunionnais courants mais sans lien réel (Hoarau, Payet, Grondin,
--     Boyer, Dijoux, Maillot, Lebon, Robert, Vergoz, Bègue)
--   • NIRs fictifs avec clé de contrôle Luhn correcte (algorithme `97 - n mod 97`)
--   • Adresses de communes 974 (Saint-Denis, Saint-Pierre, Le Tampon, etc.)
--   • Téléphones format La Réunion (0262 fixe / 0692 mobile) NON attribués
--
-- À NE JAMAIS appliquer en production commerciale (RGPD : aucune donnée patient
-- réelle ne doit être co-localisée avec le seed démo).
--
-- Pour ne charger ce seed qu'en preview/staging :
--   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
--   psql "$SUPABASE_DB_URL" -f supabase/seed.demo.sql   (preview/staging seulement)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10 patients fictifs réunionnais
-- -----------------------------------------------------------------------------
-- Helper inline : calcule la clé NIR Luhn (97 - (n mod 97)) pour un NIR sans clé
-- Format NIR Réunion : `1AAMMddCCCNNN` ou `2AAMMddCCCNNN` (13 chiffres) + clé 2 chiffres
-- où CCC = code commune (974xx pour La Réunion sur ce format simplifié de démo)
-- -----------------------------------------------------------------------------

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  -- Edge Function NIR : on simule le chiffrement par null en seed démo
  -- (les fiches sans NIR sont valides ; affichage = `••• ••• ••• ••• •••`)
  -- Les NIRs réels seront ajoutés depuis l'UI une fois Edge Function configurée.
begin
  insert into public.patients (
    id, organization_id, prenom, nom, date_naissance, genre,
    telephone, telephone_normalized,
    adresse_ligne1, code_postal, ville,
    canal_contact_prefere, consentement_sms, consentement_sms_at,
    contact_urgence_nom, contact_urgence_telephone,
    nir_encrypted, nir_search_hash, nir_last4,
    archive, created_at, updated_at, created_by, updated_by
  ) values
    -- Saint-Denis — 4 patients
    ('11111111-0000-0000-0000-000000000001', org_id, 'Patrick', 'Hoarau',     '1958-03-15', 'M',
     '06 92 99 90 05', '0692999005', '9005 rue des Bambous', '97400', 'Saint-Denis',
     'sms', true, now(), 'Marie Hoarau', '0692111111',
     null, null, '01 47',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000002', org_id, 'Marie-Ange', 'Payet',  '1962-08-22', 'F',
     '02 62 99 90 08', '0262999008', '9008 allée du Volcan', '97400', 'Saint-Denis',
     'appel', false, null, 'Joseph Payet', '0692222222',
     null, null, '02 89',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000003', org_id, 'Jean-Bernard', 'Grondin', '1945-12-03', 'M',
     '06 92 99 90 04', '0692999004', '9004 chemin du Piton', '97490', 'Sainte-Clotilde',
     'aucun', false, null, null, null,
     null, null, '14 23',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000004', org_id, 'Suzanne', 'Boyer',     '1970-05-18', 'F',
     '02 62 99 90 02', '0262999002', '9002 rue des Lataniers', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Anne Boyer', '0692333333',
     null, null, '06 12',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Pierre — 3 patients
    ('11111111-0000-0000-0000-000000000005', org_id, 'André', 'Dijoux',     '1955-09-30', 'M',
     '06 92 99 90 03', '0692999003', '9003 allée des Songes', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Henri Dijoux', '0692444444',
     null, null, '08 31',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000006', org_id, 'Marlène', 'Maillot',  '1968-02-14', 'F',
     '02 62 99 90 07', '0262999007', '9007 rue des Cyclones', '97432', 'Ravine des Cabris',
     'appel', false, null, null, null,
     null, null, '12 05',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000007', org_id, 'Bernard', 'Lebon',    '1949-07-08', 'M',
     '06 92 99 90 06', '0692999006', '9006 chemin de la Ravine', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Lucie Lebon', '0692555555',
     null, null, '03 67',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Le Tampon — 2 patients
    ('11111111-0000-0000-0000-000000000008', org_id, 'Anne-Sophie', 'Robert', '1975-11-25', 'F',
     '02 62 99 90 09', '0262999009', '9009 chemin du Lagon', '97430', 'Le Tampon',
     'aucun', false, null, 'Marc Robert', '0692666666',
     null, null, '09 14',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000009', org_id, 'Yves', 'Vergoz',      '1953-04-19', 'M',
     '06 92 99 90 10', '0692999010', '9010 rue des Galets', '97418', 'La Plaine des Cafres',
     'sms', true, now(), null, null,
     null, null, '11 78',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Paul — 1 patient
    ('11111111-0000-0000-0000-000000000010', org_id, 'Christiane', 'Bègue', '1960-06-02', 'F',
     '02 62 99 90 01', '0262999001', '9001 chemin du Vacoa', '97400', 'Saint-Denis',
     'appel', false, null, 'Philippe Bègue', '0692777777',
     null, null, '04 92',
     false, now(), now(), regulateur_id, regulateur_id)
  on conflict (id) do nothing;

  -- Quelques notes opérationnelles fictives
  insert into public.patient_operational_note (
    id, organization_id, patient_id, content, author_id, created_at
  ) values
    ('22222222-0000-0000-0000-000000000001', org_id,
     '11111111-0000-0000-0000-000000000001',
     'Code immeuble : 1234A. Préfère l''entrée arrière (escalier).',
     regulateur_id, now()),
    ('22222222-0000-0000-0000-000000000002', org_id,
     '11111111-0000-0000-0000-000000000003',
     'Sourd partiel — toujours sonner deux fois. Famille présente le matin.',
     regulateur_id, now()),
    ('22222222-0000-0000-0000-000000000005', org_id,
     '11111111-0000-0000-0000-000000000005',
     'Marche avec déambulateur. Prévoir aide à la montée véhicule.',
     regulateur_id, now())
  on conflict (id) do nothing;

  -- Quelques contraintes patient
  insert into public.patient_constraint (
    id, organization_id, patient_id, type, note, created_at, created_by
  ) values
    ('33333333-0000-0000-0000-000000000003', org_id,
     '11111111-0000-0000-0000-000000000003',
     'medical_fauteuil', 'Fauteuil pliant fourni par le patient',
     now(), regulateur_id),
    ('33333333-0000-0000-0000-000000000005', org_id,
     '11111111-0000-0000-0000-000000000005',
     'accompagnement_obligatoire', null,
     now(), regulateur_id),
    ('33333333-0000-0000-0000-000000000007', org_id,
     '11111111-0000-0000-0000-000000000007',
     'horaire_matin', 'Dialyse matin — départ 7h30 max',
     now(), regulateur_id),
    ('33333333-0000-0000-0000-000000000009', org_id,
     '11111111-0000-0000-0000-000000000009',
     'medical_oxygene', 'Bouteille O2 fournie par le patient',
     now(), regulateur_id)
  on conflict (id) do nothing;

  raise notice 'Seed démo : 10 patients fictifs créés (organization_id=%)', org_id;
end $$;

-- -----------------------------------------------------------------------------
-- 3 chauffeurs fictifs + 3 véhicules fictifs (Passe 1 E2E v2 — Phase 3)
-- -----------------------------------------------------------------------------
-- DEC-031 (UAT multi-chauffeurs) : les 3 chauffeurs sont rattachés à un
-- compte Auth distinct pour permettre la connexion individuelle UAT.
--   Vergoz Jean  → chauffeur@demo.tap   (id 030)
--   Maillot André → chauffeur2@demo.tap (id 031)
--   Boyer Sophie → chauffeur3@demo.tap  (id 032)
-- L'hypothèse historique « un seul chauffeur lié auth » est obsolète post
-- Phase 04 : le workflow d'invitation rattache les nouveaux drivers à la
-- demande, mais le seed démo expose 3 chauffeurs déjà connectables pour
-- accélérer la validation UAT.
do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  dirigeant_id uuid := '00000000-0000-0000-0000-000000000010';
  chauffeur_auth_id   uuid := '00000000-0000-0000-0000-000000000030';
  chauffeur_auth_id_2 uuid := '00000000-0000-0000-0000-000000000031';
  chauffeur_auth_id_3 uuid := '00000000-0000-0000-0000-000000000032';
begin
  insert into public.drivers (
    id, organization_id, profile_id, nom_affichage, telephone,
    numero_licence, type_permis, actif, created_by
  ) values
    ('22222222-0000-0000-0000-000000000011', org_id, chauffeur_auth_id,
     'Vergoz Jean', '0692100001', 'LIC-974-001', '{taxi}'::text[], true, dirigeant_id),
    ('22222222-0000-0000-0000-000000000012', org_id, chauffeur_auth_id_2,
     'Maillot André', '0693100002', 'LIC-974-002', '{taxi}'::text[], true, dirigeant_id),
    ('22222222-0000-0000-0000-000000000013', org_id, chauffeur_auth_id_3,
     'Boyer Sophie', '0692100003', 'LIC-974-003', '{taxi,tpmr}'::text[], true, dirigeant_id)
  on conflict (id) do update
    set profile_id = excluded.profile_id;

  insert into public.vehicles (
    id, organization_id, immatriculation, marque, modele, type,
    places_assises, places_tpmr, actif, created_by
  ) values
    ('33333333-0000-0000-0000-000000000011', org_id,
     'AB-123-CD', 'Dacia', 'Lodgy', 'taxi_conventionne',
     4, null, true, dirigeant_id),
    ('33333333-0000-0000-0000-000000000012', org_id,
     'EF-456-GH', 'Renault', 'Master', 'tpmr',
     6, 1, true, dirigeant_id),
    ('33333333-0000-0000-0000-000000000013', org_id,
     'IJ-789-KL', 'Citroën', 'Berlingo', 'vsl',
     3, null, true, dirigeant_id)
  on conflict (id) do nothing;

  raise notice 'Seed démo : 3 chauffeurs + 3 véhicules créés (organization_id=%)', org_id;
end $$;

-- -----------------------------------------------------------------------------
-- 12 courses fictives (UAT cockpit + multi-chauffeurs) — DEC-031
-- -----------------------------------------------------------------------------
-- Distribution :
--   - 5 courses historiques (J-3 à J-1, statuts mixtes terminees / annulee)
--   - 4 courses du jour (mix validee / assignee / en_cours)
--   - 3 courses planifiées J+1 (préparation journée suivante)
--
-- Adaptations au schéma rides réel (enums + colonnes vs spec brief) :
--   - status enum réel : validee / assignee / en_cours / terminee /
--     annulee_regulateur (pas planifiee / annulee génériques)
--   - transport_mode (enum) au lieu de type_course
--   - tarif_amount_eur au lieu de tarif_eur
--   - urgency = 'programmee' par défaut (pas de champ mode aller_simple)
--   - created_by + updated_by obligatoires
--   - cancel_motif renseigné pour la course annulée
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id      uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id     uuid := '22222222-0000-0000-0000-000000000012';
  boyer_id       uuid := '22222222-0000-0000-0000-000000000013';
  vehicle_dacia  uuid := '33333333-0000-0000-0000-000000000011';
  vehicle_master uuid := '33333333-0000-0000-0000-000000000012';
  patient_ids    uuid[];
begin
  select array_agg(id order by nom)
    into patient_ids
    from public.patients
    where organization_id = org_id and archive = false
    limit 10;

  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Seed démo courses : moins de 10 patients fictifs trouvés, bloc rides ignoré.';
    return;
  end if;

  -- 5 courses historiques (J-3, J-2, J-1) — statuts terminee / annulee_regulateur
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    cancel_motif, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000001', org_id,
     patient_ids[1], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis',
     'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now() - interval '3 days') + interval '8 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '3 days') + interval '8 hours 35 minutes',
     date_trunc('day', now() - interval '3 days') + interval '9 hours 45 minutes',
     25.50, 'manuel', null,
     now() - interval '3 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000002', org_id,
     patient_ids[2], maillot_id, vehicle_dacia,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now() - interval '2 days') + interval '7 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '2 days') + interval '7 hours 5 minutes',
     date_trunc('day', now() - interval '2 days') + interval '7 hours 25 minutes',
     18.00, 'manuel', null,
     now() - interval '2 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000003', org_id,
     patient_ids[3], boyer_id, vehicle_master,
     'Foyer médicalisé Les Avirons, 97425 Les Avirons',
     'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now() - interval '2 days') + interval '14 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('day', now() - interval '2 days') + interval '14 hours 5 minutes',
     date_trunc('day', now() - interval '2 days') + interval '15 hours 30 minutes',
     42.00, 'manuel', null,
     now() - interval '2 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000004', org_id,
     patient_ids[4], vergoz_id, vehicle_dacia,
     '8 Chemin des Frangipaniers, 97419 La Possession',
     'Cabinet kiné Sainte-Marie, 97438 Sainte-Marie',
     date_trunc('day', now() - interval '1 day') + interval '10 hours',
     'annulee_regulateur', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel',
     'Patient annulé la veille (rendez-vous reporté). Course remise à J+2.',
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000005', org_id,
     patient_ids[5], maillot_id, vehicle_dacia,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis',
     'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('day', now() - interval '1 day') + interval '16 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '1 day') + interval '16 hours 35 minutes',
     date_trunc('day', now() - interval '1 day') + interval '17 hours 50 minutes',
     32.00, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE limité aux rides démo 44444444-%
  -- pour permettre le ré-application CD avec dates relatives ré-évaluées
  -- (now() recalculé à chaque seed run). WARNING : écrase modifications
  -- manuelles régulateur sur ces rides démo uniquement.
  -- DEC-039-bis (hotfix 2026-05-15) : reset EXHAUSTIF de toutes les
  -- colonnes runtime-mutables pour éviter l'état hybride seed+UAT qui
  -- violait rides_ended_after_started après démarrage/clôture manuelle.
  on conflict (id) do update set
    -- Contexte course
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    -- Workflow runtime
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    -- Tarif runtime
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    -- Paiement runtime (réinit aux défauts table)
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    -- Archive runtime (réinit défaut)
    archive = false,
    -- Annulation runtime
    cancel_motif = excluded.cancel_motif,
    -- Notes runtime (réinit null)
    notes_regulateur = null;

  -- 4 courses du jour (J0) — mix assignee / en_cours / validee (non affectée)
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, tarif_source,
    created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000010', org_id,
     patient_ids[6], vergoz_id, vehicle_dacia,
     '5 Boulevard Lacaussade, 97400 Saint-Denis',
     'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '8 hours',
     'assignee', 'taxi_conventionne', 'programmee',
     null, 'manuel',
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000011', org_id,
     patient_ids[7], maillot_id, vehicle_dacia,
     '17 Rue Sainte-Anne, 97410 Saint-Pierre',
     'Cabinet médical Saint-Louis, 97450 Saint-Louis',
     date_trunc('day', now()) + interval '9 hours 30 minutes',
     'en_cours', 'taxi_conventionne', 'programmee',
     date_trunc('day', now()) + interval '9 hours 35 minutes', 'manuel',
     now() - interval '12 hours', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000012', org_id,
     patient_ids[8], boyer_id, vehicle_master,
     'Résidence Les Mascareignes, 97432 Ravine-des-Cabris',
     'Centre de rééducation Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '13 hours',
     'assignee', 'tpmr', 'programmee',
     null, 'manuel',
     now() - interval '2 hours', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000013', org_id,
     patient_ids[9], null, null,
     '34 Rue Jean Jaurès, 97400 Saint-Denis',
     'Cabinet ophtalmologie, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '15 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     null, 'manuel',
     now() - interval '30 minutes', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J0 rides démo.
  -- DEC-039-bis (hotfix 2026-05-15) : reset EXHAUSTIF — colonnes
  -- absentes de l'INSERT (ended_at, tarif_amount_eur, cancel_motif,
  -- payment_*) explicitement remises à leurs défauts table pour
  -- corriger l'état hybride post-UAT qui violait
  -- rides_ended_after_started.
  on conflict (id) do update set
    -- Contexte course
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    -- Workflow runtime
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = null,
    -- Tarif runtime (réinit défauts — INSERT ne fournit pas
    -- tarif_amount_eur pour les rides J0 non terminées)
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    -- Paiement runtime (réinit défauts table)
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    -- Archive runtime (réinit défaut)
    archive = false,
    -- Annulation runtime (J0 jamais annulée par seed)
    cancel_motif = null,
    -- Notes runtime
    notes_regulateur = null;

  -- 3 courses J+1 — préparation journée suivante (mix assignee / validee)
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    tarif_source, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000020', org_id,
     patient_ids[1], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis',
     'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '1 day' + interval '8 hours 30 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '6 hours', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000021', org_id,
     patient_ids[10], boyer_id, vehicle_master,
     'EHPAD Les Lataniers, 97419 La Possession',
     'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '1 day' + interval '10 hours',
     'assignee', 'tpmr', 'programmee',
     'manuel', now() - interval '6 hours', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000022', org_id,
     patient_ids[2], null, null,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '1 day' + interval '7 hours',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '6 hours', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J+1 rides démo.
  -- DEC-039-bis (hotfix 2026-05-15) : reset EXHAUSTIF — les rides
  -- J+1 sont seedées en 'assignee'/'validee' sans started_at ni
  -- ended_at ; reset forcé à null pour éviter état hybride
  -- post-UAT.
  on conflict (id) do update set
    -- Contexte course
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    -- Workflow runtime (réinit complet — J+1 jamais démarrée par seed)
    status = excluded.status,
    started_at = null,
    ended_at = null,
    -- Tarif runtime (réinit défauts)
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    -- Paiement runtime (réinit défauts table)
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    -- Archive runtime (réinit défaut)
    archive = false,
    -- Annulation runtime
    cancel_motif = null,
    -- Notes runtime
    notes_regulateur = null;

  -- 12 courses facturables CGSS — mois complet précédent (Phase 06 PLAN-2).
  -- Toutes terminées + tarifées + payment_status défaut 'non_concerne'
  -- (tiers payant CGSS) → peuplent l'aperçu /admin/facturation dès le login
  -- démo dirigeant. Dates relatives à date_trunc('month', now()) - 1 mois.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    cancel_motif, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000041', org_id, patient_ids[1], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '1 day' + interval '8 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '1 day' + interval '8 hours',
     date_trunc('month', now()) - interval '1 month' + interval '1 day' + interval '9 hours 30 minutes',
     24.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000042', org_id, patient_ids[2], maillot_id, vehicle_dacia,
     '45 Avenue de la République, 97410 Saint-Pierre', 'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '3 days' + interval '7 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '3 days' + interval '7 hours',
     date_trunc('month', now()) - interval '1 month' + interval '3 days' + interval '8 hours',
     18.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '3 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000043', org_id, patient_ids[3], boyer_id, vehicle_master,
     'Foyer médicalisé Les Avirons, 97425 Les Avirons', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '4 days' + interval '13 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '4 days' + interval '13 hours',
     date_trunc('month', now()) - interval '1 month' + interval '4 days' + interval '14 hours 45 minutes',
     52.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '4 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000044', org_id, patient_ids[4], vergoz_id, vehicle_dacia,
     '8 Chemin des Frangipaniers, 97419 La Possession', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '6 days' + interval '9 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '6 days' + interval '9 hours',
     date_trunc('month', now()) - interval '1 month' + interval '6 days' + interval '10 hours 15 minutes',
     31.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '6 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000045', org_id, patient_ids[5], maillot_id, vehicle_dacia,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '8 days' + interval '10 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '8 days' + interval '10 hours',
     date_trunc('month', now()) - interval '1 month' + interval '8 days' + interval '11 hours',
     27.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '8 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000046', org_id, patient_ids[6], boyer_id, vehicle_master,
     'Résidence Les Mascareignes, 97432 Ravine-des-Cabris', 'Centre de rééducation Tampon, 97430 Le Tampon',
     date_trunc('month', now()) - interval '1 month' + interval '10 days' + interval '14 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '10 days' + interval '14 hours',
     date_trunc('month', now()) - interval '1 month' + interval '10 days' + interval '15 hours 30 minutes',
     44.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '10 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000047', org_id, patient_ids[7], vergoz_id, vehicle_dacia,
     '17 Rue Sainte-Anne, 97410 Saint-Pierre', 'Cabinet médical Saint-Louis, 97450 Saint-Louis',
     date_trunc('month', now()) - interval '1 month' + interval '12 days' + interval '8 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '12 days' + interval '8 hours 30 minutes',
     date_trunc('month', now()) - interval '1 month' + interval '12 days' + interval '9 hours 15 minutes',
     16.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '12 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000048', org_id, patient_ids[8], maillot_id, vehicle_dacia,
     '5 Boulevard Lacaussade, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '14 days' + interval '11 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '14 days' + interval '11 hours',
     date_trunc('month', now()) - interval '1 month' + interval '14 days' + interval '12 hours 20 minutes',
     38.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '14 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000049', org_id, patient_ids[9], boyer_id, vehicle_master,
     'EHPAD Les Lataniers, 97419 La Possession', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '16 days' + interval '13 hours 30 minutes',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '16 days' + interval '13 hours 30 minutes',
     date_trunc('month', now()) - interval '1 month' + interval '16 days' + interval '15 hours',
     49.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '16 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000050', org_id, patient_ids[10], vergoz_id, vehicle_dacia,
     '34 Rue Jean Jaurès, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '18 days' + interval '7 hours',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '18 days' + interval '7 hours',
     date_trunc('month', now()) - interval '1 month' + interval '18 days' + interval '8 hours',
     22.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '18 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000051', org_id, patient_ids[1], maillot_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('month', now()) - interval '1 month' + interval '20 days' + interval '9 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '20 days' + interval '9 hours 30 minutes',
     date_trunc('month', now()) - interval '1 month' + interval '20 days' + interval '10 hours 45 minutes',
     35.00, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '20 days', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000052', org_id, patient_ids[2], boyer_id, vehicle_master,
     'Résidence Les Mascareignes, 97432 Ravine-des-Cabris', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('month', now()) - interval '1 month' + interval '23 days' + interval '14 hours',
     'terminee', 'tpmr', 'programmee',
     date_trunc('month', now()) - interval '1 month' + interval '23 days' + interval '14 hours',
     date_trunc('month', now()) - interval '1 month' + interval '23 days' + interval '15 hours 20 minutes',
     41.50, 'manuel', null,
     date_trunc('month', now()) - interval '1 month' + interval '23 days', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE exhaustif (dates relatives ré-évaluées
  -- à chaque run CD ; écrase d'éventuelles modifications manuelles UAT).
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  raise notice 'Seed démo : 24 courses fictives créées (5 historiques + 4 jour + 3 J+1 + 12 facturables CGSS mois précédent)';
end $$;

-- -----------------------------------------------------------------------------
-- 30 POI métier (lieux fréquents 974) — PLAN-3 Phase 04.5
-- -----------------------------------------------------------------------------
-- Source : noms/adresses publics des établissements de santé La Réunion
-- (CHU, cliniques, EHPAD, centres dialyse, cabinets, imagerie, laboratoires).
-- IDs préfixés `66666666-` pour repérage immédiat lors de purges démo.
-- ON CONFLICT (id) DO UPDATE : pattern DEC-039 idempotent — le reseed
-- met à jour adresse / téléphone si modifié dans le repo, sans dupliquer.
-- -----------------------------------------------------------------------------

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.pois_metier (
    id, organization_id, nom_court, nom_long, type_poi,
    adresse, code_postal, ville, telephone, notes_acces, actif
  ) values
    -- CHU / hôpitaux
    ('66666666-0000-0000-0000-000000000001', org_id,
     'CHU Félix Guyon', 'Centre Hospitalier Universitaire de La Réunion — site Félix Guyon',
     'hopital', 'Allée des Topazes, Bellepierre', '97400', 'Saint-Denis',
     '0262905050', 'Entrée urgences à gauche du bâtiment principal.', true),
    ('66666666-0000-0000-0000-000000000002', org_id,
     'CHU Sud Saint-Pierre', 'Centre Hospitalier Universitaire de La Réunion — site Sud',
     'hopital', 'Avenue du Président Mitterrand, Terre-Sainte', '97410', 'Saint-Pierre',
     '0262359000', 'Parking dépose-minute devant l''accueil principal.', true),
    ('66666666-0000-0000-0000-000000000003', org_id,
     'GHER Saint-Benoît', 'Groupe Hospitalier Est Réunion',
     'hopital', 'Rue de l''Amiral Lacaze', '97470', 'Saint-Benoît',
     '0262988585', 'Accès consultations externes côté rue Lacaze.', true),
    ('66666666-0000-0000-0000-000000000004', org_id,
     'CH Gabriel Martin', 'Centre Hospitalier Gabriel Martin Saint-Paul',
     'hopital', 'Route du Théâtre, Saint-Paul', '97460', 'Saint-Paul',
     '0262458282', 'Parking visiteurs au niveau -1.', true),
    -- Cliniques
    ('66666666-0000-0000-0000-000000000005', org_id,
     'Clinique Saint-Vincent', 'Clinique Saint-Vincent Saint-Denis',
     'clinique', '60 Rue Bertin', '97400', 'Saint-Denis',
     '0262907777', 'Dépose-minute autorisée 10 min devant l''entrée.', true),
    ('66666666-0000-0000-0000-000000000006', org_id,
     'Clinique Sainte-Clotilde', 'Clinique Sainte-Clotilde',
     'clinique', '127 Route de Bois-de-Nèfles', '97490', 'Saint-Denis',
     '0262487777', 'Accès urgences à l''arrière du bâtiment.', true),
    ('66666666-0000-0000-0000-000000000007', org_id,
     'Clinique Jeanne d''Arc', 'Clinique Jeanne d''Arc Le Port',
     'clinique', '12 Rue Jeanne d''Arc', '97420', 'Le Port',
     '0262423333', 'Parking gratuit côté nord.', true),
    -- Centres dialyse
    ('66666666-0000-0000-0000-000000000008', org_id,
     'Dialyse Nord Sainte-Marie', 'Centre de dialyse AURAR Sainte-Marie',
     'centre_dialyse', 'Route nationale 2, Duparc', '97438', 'Sainte-Marie',
     '0262538080', 'Accueil dialyse de 6h à 23h, 3 séances/jour.', true),
    ('66666666-0000-0000-0000-000000000009', org_id,
     'Dialyse Sud Le Tampon', 'Centre de dialyse AURAR Le Tampon',
     'centre_dialyse', '85 Rue Hubert Delisle', '97430', 'Le Tampon',
     '0262278080', 'Parking PMR devant l''entrée.', true),
    ('66666666-0000-0000-0000-000000000010', org_id,
     'Dialyse Saint-Paul', 'Centre de dialyse Saint-Paul',
     'centre_dialyse', 'Avenue de Bourbon', '97460', 'Saint-Paul',
     '0262458080', 'Entrée patients sur le côté du bâtiment.', true),
    -- EHPAD (5)
    ('66666666-0000-0000-0000-000000000011', org_id,
     'EHPAD Les Lataniers', 'EHPAD Les Lataniers La Possession',
     'ehpad', 'Route de Sainte-Thérèse', '97419', 'La Possession',
     '0262221122', 'Sonner à l''interphone, accueil 7h-19h.', true),
    ('66666666-0000-0000-0000-000000000012', org_id,
     'EHPAD Les Mascareignes', 'EHPAD Les Mascareignes Le Tampon',
     'ehpad', '14 Rue des Mascareignes', '97430', 'Le Tampon',
     '0262271133', 'Parking visiteurs limité, dépose-minute conseillée.', true),
    ('66666666-0000-0000-0000-000000000013', org_id,
     'EHPAD Albert Barbot', 'EHPAD Albert Barbot Saint-Denis',
     'ehpad', '5 Rue Albert Barbot', '97400', 'Saint-Denis',
     '0262901144', 'Sonner interphone, demander unité Alzheimer si patient atteint.', true),
    ('66666666-0000-0000-0000-000000000014', org_id,
     'EHPAD Les Alizés', 'EHPAD Les Alizés Saint-Pierre',
     'ehpad', '30 Boulevard Hubert Delisle', '97410', 'Saint-Pierre',
     '0262351155', 'Accueil 8h-18h, dépose-minute autorisée.', true),
    ('66666666-0000-0000-0000-000000000015', org_id,
     'EHPAD Les Tamarins', 'EHPAD Les Tamarins Sainte-Suzanne',
     'ehpad', 'Route du Cimetière', '97441', 'Sainte-Suzanne',
     '0262521166', 'Parking PMR à droite de l''entrée principale.', true),
    -- Cabinets kiné (3)
    ('66666666-0000-0000-0000-000000000016', org_id,
     'Cabinet kiné Saint-Denis Centre', 'Cabinet de kinésithérapie 8 Rue Pasteur',
     'cabinet_kine', '8 Rue Pasteur', '97400', 'Saint-Denis',
     '0262202211', 'RDV uniquement, sonner interphone B.', true),
    ('66666666-0000-0000-0000-000000000017', org_id,
     'Cabinet kiné Saint-Pierre', 'Cabinet de kinésithérapie Boulevard Hubert Delisle',
     'cabinet_kine', '22 Boulevard Hubert Delisle', '97410', 'Saint-Pierre',
     '0262352211', 'Parking 5 min devant l''immeuble.', true),
    ('66666666-0000-0000-0000-000000000018', org_id,
     'Cabinet kiné Saint-Paul', 'Cabinet de kinésithérapie Front de mer',
     'cabinet_kine', '5 Rue de la Compagnie des Indes', '97460', 'Saint-Paul',
     '0262452211', 'Au 1er étage, ascenseur à droite.', true),
    -- Cabinets ophtalmo (2)
    ('66666666-0000-0000-0000-000000000019', org_id,
     'Cabinet ophtalmo Saint-Denis', 'Cabinet ophtalmologie centre-ville',
     'cabinet_medical', '14 Rue Jean Chatel', '97400', 'Saint-Denis',
     '0262203322', 'RDV uniquement, salle d''attente 1er étage.', true),
    ('66666666-0000-0000-0000-000000000020', org_id,
     'Cabinet ophtalmo Saint-Pierre', 'Cabinet ophtalmologie Saint-Pierre',
     'cabinet_medical', '7 Rue des Bons-Enfants', '97410', 'Saint-Pierre',
     '0262353322', 'Parking visiteurs gratuit 1h.', true),
    -- Cabinets dentaires (2)
    ('66666666-0000-0000-0000-000000000021', org_id,
     'Cabinet dentaire Saint-Denis', 'Cabinet dentaire Centre-ville',
     'cabinet_medical', '32 Rue de Paris', '97400', 'Saint-Denis',
     '0262204433', 'Au 2e étage, ascenseur disponible.', true),
    ('66666666-0000-0000-0000-000000000022', org_id,
     'Cabinet dentaire Le Tampon', 'Cabinet dentaire Hubert Delisle',
     'cabinet_medical', '88 Rue Hubert Delisle', '97430', 'Le Tampon',
     '0262274433', 'Parking visiteurs 30 min.', true),
    -- Médecine générale (3)
    ('66666666-0000-0000-0000-000000000023', org_id,
     'Cabinet médecine Saint-Denis Bellepierre', 'Cabinet de médecine générale Bellepierre',
     'cabinet_medical', 'Allée des Topazes', '97400', 'Saint-Denis',
     '0262205544', 'Salle d''attente 1er étage, sans rendez-vous matin.', true),
    ('66666666-0000-0000-0000-000000000024', org_id,
     'Cabinet médecine Saint-Pierre', 'Cabinet de médecine générale Saint-Pierre',
     'cabinet_medical', '45 Rue François de Mahy', '97410', 'Saint-Pierre',
     '0262355544', 'Parking devant le cabinet, RDV uniquement.', true),
    ('66666666-0000-0000-0000-000000000025', org_id,
     'Cabinet médecine Le Tampon', 'Cabinet de médecine générale Le Tampon',
     'cabinet_medical', '120 Rue Hubert Delisle', '97430', 'Le Tampon',
     '0262275544', 'Sonner interphone porte A.', true),
    -- Imagerie / labo (3)
    ('66666666-0000-0000-0000-000000000026', org_id,
     'Centre imagerie Saint-Denis', 'Centre imagerie médicale Saint-Denis',
     'centre_imagerie', '18 Rue Labourdonnais', '97400', 'Saint-Denis',
     '0262206655', 'Parking sous-sol payant 1h offerte.', true),
    ('66666666-0000-0000-0000-000000000027', org_id,
     'Labo Réunion Bio Saint-Pierre', 'Laboratoire Réunion Bio Saint-Pierre',
     'laboratoire', '11 Rue Augustin Archambaud', '97410', 'Saint-Pierre',
     '0262357766', 'Prélèvements 6h30-12h, accueil debout.', true),
    ('66666666-0000-0000-0000-000000000028', org_id,
     'Centre radio Saint-Paul', 'Centre de radiologie Saint-Paul',
     'centre_imagerie', '8 Rue de la Mairie', '97460', 'Saint-Paul',
     '0262456655', 'Parking visiteurs gratuit 2h.', true),
    -- Foyer médicalisé + pharmacie (2)
    ('66666666-0000-0000-0000-000000000029', org_id,
     'Foyer Les Hibiscus', 'Foyer d''accueil médicalisé Les Hibiscus Saint-Joseph',
     'foyer_medicalise', 'Route de la Plaine', '97480', 'Saint-Joseph',
     '0262567788', 'Accueil 8h-18h, sonner interphone bâtiment B.', true),
    ('66666666-0000-0000-0000-000000000030', org_id,
     'Pharmacie de l''Océan', 'Pharmacie de l''Océan Sainte-Marie',
     'pharmacie', '12 Rue de l''Océan', '97438', 'Sainte-Marie',
     '0262538899', 'Place handicapée devant la vitrine.', true)
  on conflict (id) do update set
    nom_court = excluded.nom_court,
    nom_long = excluded.nom_long,
    type_poi = excluded.type_poi,
    adresse = excluded.adresse,
    code_postal = excluded.code_postal,
    ville = excluded.ville,
    telephone = excluded.telephone,
    notes_acces = excluded.notes_acces,
    actif = excluded.actif;

  raise notice 'Seed démo : 30 POI métier créés/mis à jour (organization_id=%)', org_id;
end $$;

-- -----------------------------------------------------------------------------
-- Données futures (commentées tant que migrations Phase 4+ pas en place)
-- -----------------------------------------------------------------------------
-- TODO Phase 4 (récurrences) :
--   - 5 prescriptions actives (dialyse 3×/sem, chimio 1×/sem, kiné 2×/sem)
--   - 30 occurrences générées (rides) sur les 30 prochains jours
-- TODO Phase 6 (planning) :
--   - 200 rides historiques sur 60 derniers jours pour KPIs et démo cockpit
-- DEC-031 (2026-05-13) : 3 chauffeurs avec credentials Auth pour UAT
-- multi-chauffeurs (Vergoz / Maillot / Boyer). Le workflow d'invitation
-- Phase 04 permet d'ajouter des chauffeurs à la demande sans toucher au
-- seed. Le scope « 6 chauffeurs démo conformité » initial ne s'applique
-- plus tel quel : la conformité Phase 15 se prouve via captures workflow.

-- Phase 10.0 prototype géoloc (DEC-096) : positions chauffeurs fictives.
-- Statiques (aucune animation, aucun simulateur de déplacement) sur des
-- coordonnées 974 réelles. Horodatages variés pour illustrer le rendu
-- « vu il y a X min » côté cockpit. Source 'demo' uniquement — non
-- purgée par la rétention 90j tant qu'on est en démo.
do $$
declare
  org_id uuid := '11111111-0000-0000-0000-000000000001';
  drv1 uuid := '22222222-0000-0000-0000-000000000011';
  drv2 uuid := '22222222-0000-0000-0000-000000000012';
  drv3 uuid := '22222222-0000-0000-0000-000000000013';
begin
  -- Position fraîche (< 5 min) — apparait en couleur primary
  insert into public.driver_positions
    (organization_id, driver_id, ride_id, lat, lng, accuracy, captured_at, source)
  values
    (org_id, drv1, null, -20.8825, 55.4513, 18.0, now() - interval '2 minutes', 'demo')
  on conflict do nothing;

  -- Position légèrement ancienne (15 min) — couleur muted, label « 15 min »
  insert into public.driver_positions
    (organization_id, driver_id, ride_id, lat, lng, accuracy, captured_at, source)
  values
    (org_id, drv2, null, -21.3393, 55.4781, 22.0, now() - interval '15 minutes', 'demo')
  on conflict do nothing;

  -- Position ancienne (1 h 20) — label « 1 h20 »
  insert into public.driver_positions
    (organization_id, driver_id, ride_id, lat, lng, accuracy, captured_at, source)
  values
    (org_id, drv3, null, -21.0344, 55.7124, 35.0, now() - interval '80 minutes', 'demo')
  on conflict do nothing;
end$$;

-- Donneurs d'ordres B2B fictifs 974 (CdC §5.5, DEC-148) — pour que le
-- référentiel /admin/donneurs-ordres et le rattachement de course soient
-- immédiatement démontrables sur la preview. Établissements crédibles 974.
-- SIRET facultatif : l'EHPAD illustre le cas « sans SIRET » (colonne nullable).
do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.ordering_parties
    (id, organization_id, raison_sociale, siret, contact_principal_nom,
     contact_principal_telephone, contact_principal_email, modalite_facturation, actif)
  values
    ('33333333-0000-0000-0000-000000000001', org_id,
     'Centre Hospitalier Universitaire de La Réunion', '40483304800014',
     'Service transport sanitaire', '0262 90 50 50', 'transport@chu-reunion.re',
     'mensuelle', true),
    ('33333333-0000-0000-0000-000000000002', org_id,
     'Clinique Sainte-Clotilde', '34280619200017',
     'Bureau des sorties', '0262 48 20 20', 'sorties@clinique-sainteclotilde.re',
     'hebdomadaire', true),
    ('33333333-0000-0000-0000-000000000003', org_id,
     'EHPAD Les Alizés (Le Tampon)', null,
     'Direction', '0262 27 10 10', 'accueil@ehpad-lesalizes.re',
     'a_la_course', true)
  on conflict (id) do nothing;

  raise notice 'Seed démo : 3 donneurs d''ordres B2B fictifs créés (organization_id=%)', org_id;
end$$;

-- =============================================================================
-- SEED-01 — Amorce facturation : prescripteurs, prescriptions, modes de
-- paiement et cas particuliers (données fictives 974, preview/staging).
-- =============================================================================
-- Comble les trous côté facturation conventionnée à venir : sans prescription
-- ni prescripteur, impossible d'éprouver le lien course→bon, les alertes de
-- renouvellement et la facturation. Idempotent (ON CONFLICT + reset ciblé).
--
-- DÉPENDANCES DE SCHÉMA NOTÉES (non ajoutées ici — ce lot peuple, ne migre pas) :
--   • Paiement « mixte » : l'enum payment_method vaut cash/cb/cheque/cgss_differe,
--     sans valeur « mixte » ni ventilation multi-lignes. Cas non représentable
--     tel quel → à cadrer par le chantier facturation (table de règlements ?).
--   • Exonération ALD : aucune colonne d'exonération (ALD / ticket modérateur)
--     sur rides ni prescriptions. Cas non représentable → dépendance facturation.
--
-- Préfixes UUID : prescripteurs 55555555, prescriptions 88888888, courses
-- facturation 44444444-…06x (au-dessus du max existant …052). pois_metier
-- utilise 66666666 (ne pas confondre).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Prescripteurs fictifs : 2 médecins (RPPS) + 1 établissement (FINESS)
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
begin
  insert into public.prescribers (
    id, organization_id, nom, prenom, type, rpps, finess, specialite,
    contact_telephone, contact_email, adresse, actif, created_by
  ) values
    ('55555555-0000-0000-0000-000000000001', org_id,
     'Payet', 'Marie-Claude', 'medecin', '10000000001', null, 'Néphrologie',
     '0262 90 51 00', 'mc.payet@cabinet-demo.re',
     'Cabinet de néphrologie, 97400 Saint-Denis', true, regulateur_id),
    ('55555555-0000-0000-0000-000000000002', org_id,
     'Grondin', 'Jean-Bernard', 'medecin', '10000000002', null, 'Médecine générale',
     '0262 27 42 00', 'jb.grondin@cabinet-demo.re',
     '18 Rue Hubert Delisle, 97430 Le Tampon', true, regulateur_id),
    ('55555555-0000-0000-0000-000000000003', org_id,
     'CHU de La Réunion — Service néphrologie', null, 'etablissement', null, '970000001',
     'Néphrologie / dialyse', '0262 90 50 50', 'nephrologie@chu-demo.re',
     'CHU Félix Guyon, 97400 Saint-Denis', true, regulateur_id)
  -- Réappliquer met à jour les champs de référence (pas d'état runtime ici).
  on conflict (id) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    type = excluded.type,
    rpps = excluded.rpps,
    finess = excluded.finess,
    specialite = excluded.specialite,
    contact_telephone = excluded.contact_telephone,
    contact_email = excluded.contact_email,
    adresse = excluded.adresse,
    actif = excluded.actif,
    archive = false,
    archive_at = null;

  raise notice 'Seed démo SEED-01 : 3 prescripteurs fictifs (organization_id=%)', org_id;
end$$;

-- -----------------------------------------------------------------------------
-- Prescriptions fictives : simple / série (dialyse) / proche échéance / expirée
-- -----------------------------------------------------------------------------
-- Rattachées à des patients existants (tri par nom, mêmes 10 que le bloc rides)
-- et aux prescripteurs ci-dessus. trajets_consommes / statut sont maintenus par
-- le trigger de comptage (rides_prescription_counter) dès qu'une course
-- consommatrice est rattachée : on ne les RÉINITIALISE PAS au ré-seed (sinon
-- état hybride vs trigger). On ne (ré)initialise que les champs statiques du bon.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  medecin_nephro uuid := '55555555-0000-0000-0000-000000000001';
  medecin_gen    uuid := '55555555-0000-0000-0000-000000000002';
  etab_chu       uuid := '55555555-0000-0000-0000-000000000003';
  patient_ids    uuid[];
begin
  select array_agg(id order by nom)
    into patient_ids
    from public.patients
    where organization_id = org_id and archive = false;

  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Seed démo SEED-01 : moins de 10 patients, bloc prescriptions ignoré.';
    return;
  end if;

  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, numero, date_prescription,
    finess, motif, type_transport, trajets_autorises, date_expiration, statut,
    created_by
  ) values
    -- Simple, active (transport ponctuel — consultation de suivi)
    ('88888888-0000-0000-0000-000000000001', org_id, patient_ids[1], medecin_gen,
     'BT-DEMO-2026-0001', current_date - 20,
     null, 'Consultation de suivi', 'taxi_conventionne', 4,
     current_date + 150, 'active', regulateur_id),
    -- Série (dialyse itérative — 20 trajets), active
    ('88888888-0000-0000-0000-000000000002', org_id, patient_ids[2], etab_chu,
     'BT-DEMO-2026-0002', current_date - 30,
     '970000001', 'Dialyse péritonéale 3x/semaine', 'taxi_conventionne', 20,
     current_date + 90, 'active', regulateur_id),
    -- Proche de l'échéance (renouvellement à anticiper — alerte)
    ('88888888-0000-0000-0000-000000000003', org_id, patient_ids[3], etab_chu,
     'BT-DEMO-2026-0003', current_date - 175,
     '970000001', 'Séances de kinésithérapie post-opératoire', 'tpmr', 10,
     current_date + 5, 'active', regulateur_id),
    -- Expirée (bon échu — ne doit plus autoriser de nouvelle course)
    ('88888888-0000-0000-0000-000000000004', org_id, patient_ids[4], medecin_nephro,
     'BT-DEMO-2025-0009', current_date - 210,
     null, 'Cure thermale', 'taxi_conventionne', 4,
     current_date - 30, 'expiree', regulateur_id),
    -- Simple, active (support d'une course encaissée directe)
    ('88888888-0000-0000-0000-000000000005', org_id, patient_ids[6], medecin_gen,
     'BT-DEMO-2026-0005', current_date - 10,
     null, 'Transport vers consultation spécialisée', 'taxi_conventionne', 4,
     current_date + 170, 'active', regulateur_id)
  -- Champs statiques réinitialisés ; trajets_consommes + statut restent
  -- pilotés par le trigger de comptage (voir en-tête de bloc).
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    prescriber_id = excluded.prescriber_id,
    numero = excluded.numero,
    date_prescription = excluded.date_prescription,
    finess = excluded.finess,
    motif = excluded.motif,
    type_transport = excluded.type_transport,
    trajets_autorises = excluded.trajets_autorises,
    date_expiration = excluded.date_expiration;

  raise notice 'Seed démo SEED-01 : 5 prescriptions fictives (organization_id=%)', org_id;
end$$;

-- -----------------------------------------------------------------------------
-- Courses « facturation » : diversité de modes de paiement + cas particuliers
-- (accompagnant, transport adapté TPMR) + rattachement à des prescriptions.
-- -----------------------------------------------------------------------------
-- Reset EXHAUSTIF vers la BASELINE SEED (excluded.*) au ré-seed — y compris les
-- champs de paiement et d'accompagnant — pour effacer toute dérive UAT sans
-- laisser d'état hybride (esprit DEC-039-bis). Le rattachement prescription_id
-- est stable → le trigger de comptage ne produit pas de delta au ré-update.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id      uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id     uuid := '22222222-0000-0000-0000-000000000012';
  boyer_id       uuid := '22222222-0000-0000-0000-000000000013';
  vehicle_dacia  uuid := '33333333-0000-0000-0000-000000000011';
  vehicle_master uuid := '33333333-0000-0000-0000-000000000012';
  presc_serie    uuid := '88888888-0000-0000-0000-000000000002';
  presc_directe  uuid := '88888888-0000-0000-0000-000000000005';
  patient_ids    uuid[];
  d2 timestamptz := date_trunc('day', now() - interval '2 days');
begin
  select array_agg(id order by nom)
    into patient_ids
    from public.patients
    where organization_id = org_id and archive = false;

  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Seed démo SEED-01 : moins de 10 patients, bloc rides facturation ignoré.';
    return;
  end if;

  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id, prescription_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    accompagnant, accompagnant_payant, accompagnant_identite,
    created_at, created_by, updated_by
  ) values
    -- Tiers payant conventionné (CGSS) — cas dominant, aucun encaissement direct
    ('44444444-0000-0000-0000-000000000060', org_id, patient_ids[2], maillot_id,
     vehicle_dacia, presc_serie,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     d2 + interval '7 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '7 hours 5 minutes', d2 + interval '7 hours 25 minutes',
     18.00, 'manuel', 'non_concerne', null, null,
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Espèces (hors prise en charge) — encaissé
    ('44444444-0000-0000-0000-000000000061', org_id, patient_ids[6], vergoz_id,
     vehicle_dacia, presc_directe,
     '5 Boulevard Lacaussade, 97400 Saint-Denis',
     'Clinique Saint-Vincent, 97400 Saint-Denis',
     d2 + interval '9 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '9 hours 5 minutes', d2 + interval '9 hours 40 minutes',
     22.00, 'manuel', 'encaisse', 'cash', d2 + interval '9 hours 40 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Carte bancaire — encaissé
    ('44444444-0000-0000-0000-000000000062', org_id, patient_ids[7], boyer_id,
     vehicle_dacia, null,
     '8 Chemin des Frangipaniers, 97419 La Possession',
     'Cabinet médical, 97460 Saint-Paul',
     d2 + interval '11 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '11 hours 5 minutes', d2 + interval '11 hours 35 minutes',
     30.00, 'manuel', 'encaisse', 'cb', d2 + interval '11 hours 35 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Chèque — encaissé
    ('44444444-0000-0000-0000-000000000063', org_id, patient_ids[8], maillot_id,
     vehicle_dacia, null,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis',
     'Laboratoire d''analyses, 97490 Sainte-Clotilde',
     d2 + interval '13 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '13 hours 5 minutes', d2 + interval '13 hours 30 minutes',
     28.00, 'manuel', 'encaisse', 'cheque', d2 + interval '13 hours 30 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- CGSS différé — encaissement décalé de la part conventionnée
    ('44444444-0000-0000-0000-000000000064', org_id, patient_ids[9], vergoz_id,
     vehicle_master, null,
     'Foyer Les Avirons, 97425 Les Avirons',
     'CHU Sud, 97448 Saint-Pierre',
     d2 + interval '15 hours', 'terminee', 'vsl', 'programmee',
     d2 + interval '15 hours 5 minutes', d2 + interval '16 hours 10 minutes',
     35.00, 'manuel', 'encaisse', 'cgss_differe', d2 + interval '16 hours 10 minutes',
     false, false, null,
     d2, regulateur_id, regulateur_id),
    -- Cas particulier : accompagnant payant + transport adapté (TPMR)
    ('44444444-0000-0000-0000-000000000065', org_id, patient_ids[2], boyer_id,
     vehicle_master, presc_serie,
     '45 Avenue de la République, 97410 Saint-Pierre',
     'Centre de dialyse Sud, 97410 Saint-Pierre',
     d2 + interval '17 hours', 'terminee', 'tpmr', 'programmee',
     d2 + interval '17 hours 5 minutes', d2 + interval '17 hours 45 minutes',
     42.00, 'manuel', 'non_concerne', null, null,
     true, true, 'Accompagnant : proche aidant (fille)',
     d2, regulateur_id, regulateur_id),
    -- Reste à encaisser (créance en attente de règlement)
    ('44444444-0000-0000-0000-000000000066', org_id, patient_ids[10], maillot_id,
     vehicle_dacia, null,
     '12 Rue de Paris, 97400 Saint-Denis',
     'Centre de radiologie, 97400 Saint-Denis',
     d2 + interval '18 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d2 + interval '18 hours 5 minutes', d2 + interval '18 hours 30 minutes',
     20.00, 'manuel', 'a_encaisser', null, null,
     false, false, null,
     d2, regulateur_id, regulateur_id)
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    prescription_id = excluded.prescription_id,
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status,
    payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at,
    accompagnant = excluded.accompagnant,
    accompagnant_payant = excluded.accompagnant_payant,
    accompagnant_identite = excluded.accompagnant_identite,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  raise notice 'Seed démo SEED-01 : 7 courses facturation (paiements variés + accompagnant/TPMR)';
end$$;

-- =============================================================================
-- FACTURATION bloc 1 — régime de prise en charge + refus transport partagé.
-- =============================================================================
-- Cas de démonstration pour la ventilation assurance/patient et le refus de
-- transport partagé (colonnes rides prise_en_charge_taux / exoneration_motif /
-- transport_partage_refuse — migration 20260613000020). Bloc AUTONOME : ne
-- dépend pas d'un autre seed (crée son propre prescripteur + prescription).
-- Idempotent (ON CONFLICT ; compteur prescription piloté par le trigger).
--
-- AMBIGUÏTÉ SIGNALÉE : la mention conventionnelle de refus et la bascule « hors
-- tiers payant » concernent en toute rigueur la facture PATIENT (paiement
-- direct), tandis que la facture existante est le récapitulatif CGSS (tiers
-- payant). Pour rendre la règle DÉMONTRABLE sur le document existant, la course
-- refusée reste listée (paiement non_concerne) et la ventilation la marque hors
-- TP (part assurance = 0) avec la mention. La bascule effective du statut de
-- paiement vers le direct relève du workflow runtime (hors de ce seed).
-- =============================================================================
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id     uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id    uuid := '22222222-0000-0000-0000-000000000012';
  vehicle_dacia uuid := '33333333-0000-0000-0000-000000000011';
  presc_fact    uuid := '88888888-0000-0000-0000-000000000009';
  patient_ids   uuid[];
  d1 timestamptz := date_trunc('day', now() - interval '1 day');
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'Facturation bloc 1 : moins de 10 patients, bloc régime ignoré.';
    return;
  end if;

  -- Prescripteur + prescription autonomes (soins itératifs = dialyse).
  insert into public.prescribers (id, organization_id, nom, type, finess, created_by)
  values ('55555555-0000-0000-0000-000000000009', org_id,
          'Cabinet néphrologie facturation', 'etablissement', '970000009', regulateur_id)
  on conflict (id) do update set nom = excluded.nom, type = excluded.type, finess = excluded.finess;

  insert into public.prescriptions
    (id, organization_id, patient_id, prescriber_id, numero, date_prescription,
     trajets_autorises, date_expiration, statut, created_by)
  values (presc_fact, org_id, patient_ids[1], '55555555-0000-0000-0000-000000000009',
          'BT-FACT-2026-0009', current_date - 15, 30, current_date + 120, 'active', regulateur_id)
  on conflict (id) do update set
    patient_id = excluded.patient_id, prescriber_id = excluded.prescriber_id,
    numero = excluded.numero, date_prescription = excluded.date_prescription,
    trajets_autorises = excluded.trajets_autorises, date_expiration = excluded.date_expiration;

  -- Courses couvrant les cas de régime. Toutes en tiers payant (non_concerne)
  -- pour apparaître sur le récapitulatif CGSS et y montrer la ventilation.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id, prescription_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    prise_en_charge_taux, exoneration_motif, transport_partage_refuse,
    created_at, created_by, updated_by
  ) values
    -- 100 % ALD en lien (dialyse) — pas de ticket modérateur
    ('44444444-0000-0000-0000-000000000070', org_id, patient_ids[1], vergoz_id, vehicle_dacia, presc_fact,
     '12 Rue de Paris, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     d1 + interval '7 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '7 hours 5 minutes', d1 + interval '7 hours 30 minutes',
     30.00, 'manuel', 'non_concerne', null, null,
     100, 'ald_lien', false, d1, regulateur_id, regulateur_id),
    -- Taux général 65 % — ticket modérateur à la charge du patient
    ('44444444-0000-0000-0000-000000000071', org_id, patient_ids[3], maillot_id, vehicle_dacia, null,
     '8 Chemin des Frangipaniers, 97419 La Possession', 'Cabinet médical, 97460 Saint-Paul',
     d1 + interval '9 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '9 hours 5 minutes', d1 + interval '9 hours 35 minutes',
     40.00, 'manuel', 'non_concerne', null, null,
     null, null, false, d1, regulateur_id, regulateur_id),
    -- 100 % accident du travail (franchise NON exonérée)
    ('44444444-0000-0000-0000-000000000072', org_id, patient_ids[5], vergoz_id, vehicle_dacia, null,
     '23 Rue Maréchal Leclerc, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     d1 + interval '11 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '11 hours 5 minutes', d1 + interval '11 hours 40 minutes',
     36.00, 'manuel', 'non_concerne', null, null,
     100, 'accident_travail', false, d1, regulateur_id, regulateur_id),
    -- CSS : 100 %, franchise exonérée, hors périmètre du refus de partage
    ('44444444-0000-0000-0000-000000000073', org_id, patient_ids[7], maillot_id, vehicle_dacia, null,
     '45 Avenue de la République, 97410 Saint-Pierre', 'CHU Sud, 97448 Saint-Pierre',
     d1 + interval '13 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '13 hours 5 minutes', d1 + interval '13 hours 45 minutes',
     34.00, 'manuel', 'non_concerne', null, null,
     100, 'css', false, d1, regulateur_id, regulateur_id),
    -- Refus de transport partagé sur soins itératifs (prescription liée) → hors
    -- tiers payant + mention. Reste listée pour démontrer la règle (voir en-tête).
    ('44444444-0000-0000-0000-000000000074', org_id, patient_ids[1], vergoz_id, vehicle_dacia, presc_fact,
     '12 Rue de Paris, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     d1 + interval '15 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '15 hours 5 minutes', d1 + interval '15 hours 30 minutes',
     30.00, 'manuel', 'non_concerne', null, null,
     null, null, true, d1, regulateur_id, regulateur_id),
    -- ALD NON exonérante : 55 %
    ('44444444-0000-0000-0000-000000000075', org_id, patient_ids[8], maillot_id, vehicle_dacia, null,
     'Foyer Les Avirons, 97425 Les Avirons', 'Laboratoire, 97490 Sainte-Clotilde',
     d1 + interval '16 hours', 'terminee', 'taxi_conventionne', 'programmee',
     d1 + interval '16 hours 5 minutes', d1 + interval '16 hours 40 minutes',
     38.00, 'manuel', 'non_concerne', null, null,
     55, null, false, d1, regulateur_id, regulateur_id)
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at, created_at = excluded.created_at,
    pickup_address = excluded.pickup_address, dropoff_address = excluded.dropoff_address,
    transport_mode = excluded.transport_mode, urgency = excluded.urgency,
    driver_id = excluded.driver_id, vehicle_id = excluded.vehicle_id,
    prescription_id = excluded.prescription_id,
    status = excluded.status, started_at = excluded.started_at, ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur, tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status, payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at,
    prise_en_charge_taux = excluded.prise_en_charge_taux,
    exoneration_motif = excluded.exoneration_motif,
    transport_partage_refuse = excluded.transport_partage_refuse,
    archive = false, cancel_motif = null, notes_regulateur = null;

  raise notice 'Facturation bloc 1 : 6 courses régime (100%% ALD, 65%%, AT, CSS, refus partagé, 55%%)';
end$$;
