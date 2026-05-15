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
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    created_at = excluded.created_at,
    status = excluded.status,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    cancel_motif = excluded.cancel_motif;

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
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J0 rides démo
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    started_at = excluded.started_at,
    created_at = excluded.created_at,
    status = excluded.status,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address;

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
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J+1 rides démo
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    status = excluded.status,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address;

  raise notice 'Seed démo : 12 courses fictives créées (5 historiques + 4 jour + 3 J+1)';
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
