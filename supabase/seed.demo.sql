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
     '06 92 99 90 05', '0692999005', '32 Rue Juliette Dodu', '97400', 'Saint-Denis',
     'sms', true, now(), 'Marie Hoarau', '0692111111',
     null, null, '01 47',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000002', org_id, 'Marie-Ange', 'Payet',  '1962-08-22', 'F',
     '02 62 99 90 08', '0262999008', '18 Rue Monseigneur de Beaumont', '97400', 'Saint-Denis',
     'appel', false, null, 'Joseph Payet', '0692222222',
     null, null, '02 89',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000003', org_id, 'Jean-Bernard', 'Grondin', '1945-12-03', 'M',
     '06 92 99 90 04', '0692999004', '25 Rue de la Trinité', '97490', 'Sainte-Clotilde',
     'aucun', false, null, null, null,
     null, null, '14 23',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000004', org_id, 'Suzanne', 'Boyer',     '1970-05-18', 'F',
     '02 62 99 90 02', '0262999002', '22 Rue Auguste Babet', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Anne Boyer', '0692333333',
     null, null, '06 12',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Pierre — 3 patients
    ('11111111-0000-0000-0000-000000000005', org_id, 'André', 'Dijoux',     '1955-09-30', 'M',
     '06 92 99 90 03', '0692999003', '15 Rue François de Mahy', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Henri Dijoux', '0692444444',
     null, null, '08 31',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000006', org_id, 'Marlène', 'Maillot',  '1968-02-14', 'F',
     '02 62 99 90 07', '0262999007', '45 Rue du Père Lafosse', '97432', 'Ravine des Cabris',
     'appel', false, null, null, null,
     null, null, '12 05',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000007', org_id, 'Bernard', 'Lebon',    '1949-07-08', 'M',
     '06 92 99 90 06', '0692999006', '30 Rue des Bons-Enfants', '97410', 'Saint-Pierre',
     'sms', true, now(), 'Lucie Lebon', '0692555555',
     null, null, '03 67',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Le Tampon — 2 patients
    ('11111111-0000-0000-0000-000000000008', org_id, 'Anne-Sophie', 'Robert', '1975-11-25', 'F',
     '02 62 99 90 09', '0262999009', '112 Rue Hubert Delisle', '97430', 'Le Tampon',
     'aucun', false, null, 'Marc Robert', '0692666666',
     null, null, '09 14',
     false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000009', org_id, 'Yves', 'Vergoz',      '1953-04-19', 'M',
     '06 92 99 90 10', '0692999010', 'Bourg-Murat', '97418', 'La Plaine des Cafres',
     'sms', true, now(), null, null,
     null, null, '11 78',
     false, now(), now(), regulateur_id, regulateur_id),
    -- Saint-Paul — 1 patient
    ('11111111-0000-0000-0000-000000000010', org_id, 'Christiane', 'Bègue', '1960-06-02', 'F',
     '02 62 99 90 01', '0262999001', '12 Rue Sainte-Anne', '97400', 'Saint-Denis',
     'appel', false, null, 'Philippe Bègue', '0692777777',
     null, null, '04 92',
     false, now(), now(), regulateur_id, regulateur_id)
  -- Les adresses réelles de démonstration font autorité au ré-seed : on met à
  -- jour l'adresse même si le patient existe déjà. Nécessaire car la migration
  -- 20260513000003 (défense en profondeur NFR-001) avait forcé des adresses
  -- fictives non géocodables ; ce seed (appliqué après les migrations) les
  -- remplace par de vraies adresses résidentielles. Identité (nom, prénom,
  -- dates, NIR, consentements) inchangée : seule l'adresse est mise à jour.
  on conflict (id) do update set
    adresse_ligne1 = excluded.adresse_ligne1,
    code_postal = excluded.code_postal,
    ville = excluded.ville;

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

  -- 8 courses du jour (J0), GÉOCODÉES — c'est CE bloc qui s'affiche dans « Ma
  -- journée » et alimente l'optimiseur. Journée pensée pour une démonstration
  -- « avant / après » parlante : au départ, tout est dispersé et non affecté ;
  -- l'optimiseur doit révéler DEUX regroupements évidents et laisser les isolées
  -- seules.
  --   - Groupe A (secteur Sud, taxi conventionné) : 3 patients vers le même
  --     centre de dialyse (Le Tampon), créneaux du matin qui se chevauchent →
  --     mutualisables sur un véhicule taxi (Dacia).
  --   - Groupe B (secteur Ouest, TPMR) : 3 patients vers le même centre de
  --     dialyse (Saint-Paul), créneaux du matin qui se chevauchent → mutualisables
  --     sur le véhicule TPMR (Master). Mode distinct = véhicule distinct : les deux
  --     tournées ne se mélangent pas.
  --   - 2 courses ISOLÉES : Saint-Denis (après-midi) et Saint-Benoît → Saint-Denis
  --     (fin de matinée) — créneaux et secteurs qui ne chevauchent aucun groupe :
  --     l'optimiseur les laisse seules (il discerne, il ne regroupe pas tout).
  -- Aucune course sans coordonnées. Prise en charge = domicile RÉEL du patient ;
  -- destination = lieu de soins du référentiel. Toutes `validee` + non affectées
  -- (driver/vehicle nuls) + NON pré-regroupées (aucun ride_group_id) : le
  -- regroupement est ce que l'optimisation doit produire. Coordonnées EN DUR,
  -- déterministes.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
    scheduled_at, status, transport_mode, urgency,
    tarif_source, created_at, created_by, updated_by
  ) values
    -- Lebon (Saint-Pierre) → Dialyse Sud Le Tampon (POI 66666666-…-0009). Groupe.
    ('44444444-0000-0000-0000-000000000010', org_id,
     patient_ids[6], null, null,
     '30 Rue des Bons-Enfants, 97410 Saint-Pierre',
     'Dialyse Sud Le Tampon, 97430 Le Tampon',
     -21.3388, 55.4802, -21.2788, 55.5158,
     date_trunc('day', now()) + interval '6 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Maillot (Ravine des Cabris) → Dialyse Sud Le Tampon. Groupe.
    ('44444444-0000-0000-0000-000000000011', org_id,
     patient_ids[7], null, null,
     '45 Rue du Père Lafosse, 97432 Ravine des Cabris',
     'Dialyse Sud Le Tampon, 97430 Le Tampon',
     -21.3020, 55.4650, -21.2788, 55.5158,
     date_trunc('day', now()) + interval '6 hours 40 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Payet (Saint-Denis) → Clinique Saint-Vincent (POI 66666666-…-0005). Isolée.
    ('44444444-0000-0000-0000-000000000012', org_id,
     patient_ids[8], null, null,
     '18 Rue Monseigneur de Beaumont, 97400 Saint-Denis',
     'Clinique Saint-Vincent, 97400 Saint-Denis',
     -20.8792, 55.4560, -20.8828, 55.4585,
     date_trunc('day', now()) + interval '14 hours',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Robert (Le Tampon) → Dialyse Sud Le Tampon. Groupe A.
    ('44444444-0000-0000-0000-000000000013', org_id,
     patient_ids[9], null, null,
     '112 Rue Hubert Delisle, 97430 Le Tampon',
     'Dialyse Sud Le Tampon, 97430 Le Tampon',
     -21.2785, 55.5160, -21.2788, 55.5158,
     date_trunc('day', now()) + interval '6 hours 50 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Groupe B (secteur Ouest, TPMR → Dialyse Saint-Paul, matin qui se chevauche).
    -- Même destination, pickups proches : mutualisables sur le véhicule TPMR.
    ('44444444-0000-0000-0000-000000000014', org_id,
     patient_ids[1], null, null,
     '12 Rue Marius et Ary Leblond, 97460 Saint-Paul',
     'Dialyse Saint-Paul, 97460 Saint-Paul',
     -21.0096, 55.2690, -21.0300, 55.2760,
     date_trunc('day', now()) + interval '7 hours',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000015', org_id,
     patient_ids[2], null, null,
     '20 Rue du Commerce, 97460 Saint-Paul',
     'Dialyse Saint-Paul, 97460 Saint-Paul',
     -21.0180, 55.2720, -21.0300, 55.2760,
     date_trunc('day', now()) + interval '7 hours 10 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000016', org_id,
     patient_ids[3], null, null,
     '8 Route de Savanna, 97460 Saint-Paul',
     'Dialyse Saint-Paul, 97460 Saint-Paul',
     -21.0450, 55.2830, -21.0300, 55.2760,
     date_trunc('day', now()) + interval '7 hours 20 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    -- Isolée 2 (secteur Est, fin de matinée) : Saint-Benoît → CHU Saint-Denis.
    -- Créneau et secteur hors de tout groupe → l'optimiseur la laisse seule.
    ('44444444-0000-0000-0000-000000000017', org_id,
     patient_ids[4], null, null,
     '3 Rue Amiral Bouvet, 97470 Saint-Benoît',
     'CHU Félix Guyon, 97400 Saint-Denis',
     -21.0340, 55.7130, -20.8853, 55.4504,
     date_trunc('day', now()) + interval '11 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id)
  -- DEC-039 : seed glissant — DO UPDATE pour bloc J0 rides démo (reporte la
  -- date J0 et les coordonnées à chaque ré-seed ; reset EXHAUSTIF des colonnes
  -- runtime absentes de l'INSERT pour éviter l'état hybride post-UAT).
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    created_at = excluded.created_at,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    pickup_lat = excluded.pickup_lat,
    pickup_lng = excluded.pickup_lng,
    dropoff_lat = excluded.dropoff_lat,
    dropoff_lng = excluded.dropoff_lng,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    status = excluded.status,
    started_at = null,
    ended_at = null,
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  -- 16 courses du jour SUPPLÉMENTAIRES (J0) — volume de démonstration pour
  -- dépasser la taille de page par défaut (25) sur la vue « Aujourd'hui » de la
  -- page courses : la pagination devient visible (> 1 page) et manipulable
  -- (page 2, changement de taille). Non géocodées (coordonnées facultatives) :
  -- ces courses alimentent la LISTE, pas l'optimiseur (qui s'appuie sur le bloc
  -- J0 géocodé ci-dessus). Variété volontaire pour donner de la matière aux
  -- filtres / tri : majorité `validee` non affectées, quelques `assignee`
  -- (chauffeur + véhicule), majorité `programmee` avec quelques urgences. Toutes
  -- communes 974, heures étalées sur la journée. Idempotent (IDs déterministes +
  -- DO UPDATE, reset runtime identique au bloc J0 ci-dessus).
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    tarif_source, created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000090', org_id, patient_ids[1], null, null,
     '5 Rue de Nice, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '6 hours 15 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000091', org_id, patient_ids[2], null, null,
     '22 Rue Auguste Babet, 97410 Saint-Pierre', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '6 hours 45 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000092', org_id, patient_ids[3], null, null,
     '9 Rue du Four à Chaux, 97460 Saint-Paul', 'Dialyse Saint-Paul, 97460 Saint-Paul',
     date_trunc('day', now()) + interval '7 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000093', org_id, patient_ids[4], null, null,
     '14 Rue de la Gare, 97440 Saint-André', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '8 hours 10 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000094', org_id, patient_ids[5], null, null,
     '2 Rue du Général de Gaulle, 97450 Saint-Louis', 'Clinique Durieux, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '8 hours 40 minutes',
     'validee', 'taxi_conventionne', 'urgente',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000095', org_id, patient_ids[6], null, null,
     '7 Rue Sarda Garriga, 97470 Saint-Benoît', 'GHER Saint-Benoît, 97470 Saint-Benoît',
     date_trunc('day', now()) + interval '9 hours 20 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000096', org_id, patient_ids[7], vergoz_id, vehicle_dacia,
     '18 Rue Bertin, 97400 Saint-Denis', 'Clinique Saint-Vincent, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '9 hours 45 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000097', org_id, patient_ids[8], null, null,
     '30 Rue Lislet Geoffroy, 97438 Sainte-Marie', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '10 hours 15 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000098', org_id, patient_ids[9], null, null,
     '4 Quai Ouest, 97420 Le Port', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '10 hours 50 minutes',
     'validee', 'taxi_conventionne', 'immediate',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-000000000099', org_id, patient_ids[10], null, null,
     '11 Rue Sainte-Thérèse, 97419 La Possession', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '11 hours 25 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009a', org_id, patient_ids[1], null, null,
     '16 Rue du Stade, 97441 Sainte-Suzanne', 'Cabinet de kinésithérapie, 97440 Saint-André',
     date_trunc('day', now()) + interval '12 hours 5 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009b', org_id, patient_ids[2], boyer_id, vehicle_master,
     '8 Route de la Plaine, 97480 Saint-Joseph', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '13 hours 10 minutes',
     'assignee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009c', org_id, patient_ids[3], null, null,
     '25 Rue Hubert Delisle, 97430 Le Tampon', 'Dialyse Sud Le Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '13 hours 40 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009d', org_id, patient_ids[4], null, null,
     '6 Rue des Avirons, 97425 Les Avirons', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '14 hours 30 minutes',
     'validee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009e', org_id, patient_ids[5], null, null,
     '19 Rue François de Mahy, 97410 Saint-Pierre', 'Cabinet ophtalmologie, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '15 hours 20 minutes',
     'validee', 'tpmr', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-00000000009f', org_id, patient_ids[6], maillot_id, vehicle_dacia,
     '3 Rue de l''Église, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '16 hours 45 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     'manuel', now() - interval '1 day', regulateur_id, regulateur_id)
  -- Idempotence : reset runtime exhaustif identique au bloc J0 géocodé ci-dessus.
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
    started_at = null,
    ended_at = null,
    tarif_amount_eur = null,
    tarif_source = excluded.tarif_source,
    payment_status = 'non_concerne',
    payment_method = null,
    payment_received_at = null,
    archive = false,
    cancel_motif = null,
    notes_regulateur = null;

  -- Tournées J0 AFFECTÉES (démonstration planning/Gantt) — pour que la grille
  -- planning ne montre pas que des lignes chauffeurs vides : deux chauffeurs ont
  -- une tournée du matin réelle (plusieurs courses enchaînées), avec variété de
  -- statuts (terminee estompée + assignee à venir). Heures UTC petites → matin
  -- réunionnais (UTC+4) ; réparties pour donner du relief à la ligne « maintenant »
  -- et au zébrage. `terminee` renseigne started_at < ended_at (contrainte
  -- rides_ended_after_started). Idempotent (IDs déterministes + reset runtime).
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address,
    scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    cancel_motif, created_at, created_by, updated_by
  ) values
    -- Vergoz — tournée du matin (Dacia) : 1 terminée + 2 à venir.
    ('44444444-0000-0000-0000-0000000000a0', org_id,
     patient_ids[1], vergoz_id, vehicle_dacia,
     '9 Rue Juliette Dodu, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '3 hours 30 minutes',
     'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now()) + interval '3 hours 35 minutes',
     date_trunc('day', now()) + interval '4 hours 15 minutes',
     24.00, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-0000000000a1', org_id,
     patient_ids[2], vergoz_id, vehicle_dacia,
     '14 Rue Pasteur, 97400 Saint-Denis', 'Clinique Sainte-Clotilde, 97490 Sainte-Clotilde',
     date_trunc('day', now()) + interval '4 hours 45 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-0000000000a2', org_id,
     patient_ids[3], vergoz_id, vehicle_dacia,
     '27 Rue Maréchal Leclerc, 97400 Saint-Denis', 'Centre de dialyse Nord, 97400 Saint-Denis',
     date_trunc('day', now()) + interval '6 hours 30 minutes',
     'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    -- Boyer — tournée du matin (Master, TPMR) : 1 terminée + 1 à venir.
    ('44444444-0000-0000-0000-0000000000a3', org_id,
     patient_ids[4], boyer_id, vehicle_master,
     'EHPAD Les Alizés, 97430 Le Tampon', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now()) + interval '3 hours 15 minutes',
     'terminee', 'tpmr', 'programmee',
     date_trunc('day', now()) + interval '3 hours 20 minutes',
     date_trunc('day', now()) + interval '4 hours 5 minutes',
     40.00, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id),

    ('44444444-0000-0000-0000-0000000000a4', org_id,
     patient_ids[5], boyer_id, vehicle_master,
     '2 Rue des Bougainvilliers, 97410 Saint-Pierre', 'Dialyse Sud Le Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '5 hours 15 minutes',
     'assignee', 'tpmr', 'programmee',
     null, null, null, 'manuel', null,
     now() - interval '1 day', regulateur_id, regulateur_id)
  -- Idempotence : reset runtime exhaustif (identique aux blocs J0 ci-dessus).
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
-- Coordonnées des lieux de soins (latitude / longitude WGS84)
-- -----------------------------------------------------------------------------
-- Coordonnées EN DUR, déterministes (pas de dépendance réseau — le géocodage
-- BAN/Géoplateforme reste le mécanisme runtime, cf. lib/geocoding). Précision
-- « commune / secteur » suffisante pour l'optimiseur (distances à vol
-- d'oiseau). Idempotent : ré-application du seed = mêmes valeurs. Ces mêmes
-- coordonnées sont réutilisées comme destination des courses vers ces lieux.
update public.pois_metier p
set latitude = c.lat, longitude = c.lng
from (values
  ('66666666-0000-0000-0000-000000000001'::uuid, -20.8895, 55.4468), -- CHU Félix Guyon, Bellepierre (Saint-Denis)
  ('66666666-0000-0000-0000-000000000002'::uuid, -21.3436, 55.4900), -- CHU Sud, Terre-Sainte (Saint-Pierre)
  ('66666666-0000-0000-0000-000000000003'::uuid, -21.0378, 55.7160), -- GHER (Saint-Benoît)
  ('66666666-0000-0000-0000-000000000004'::uuid, -21.0093, 55.2712), -- CH Gabriel Martin (Saint-Paul)
  ('66666666-0000-0000-0000-000000000005'::uuid, -20.8828, 55.4585), -- Clinique Saint-Vincent (Saint-Denis)
  ('66666666-0000-0000-0000-000000000006'::uuid, -20.9083, 55.4808), -- Clinique Sainte-Clotilde
  ('66666666-0000-0000-0000-000000000007'::uuid, -20.9385, 55.2938), -- Clinique Jeanne d'Arc (Le Port)
  ('66666666-0000-0000-0000-000000000008'::uuid, -20.8985, 55.5470), -- Dialyse Nord, Duparc (Sainte-Marie)
  ('66666666-0000-0000-0000-000000000009'::uuid, -21.2788, 55.5158), -- Dialyse Sud (Le Tampon)
  ('66666666-0000-0000-0000-000000000010'::uuid, -21.0102, 55.2735), -- Dialyse Saint-Paul
  ('66666666-0000-0000-0000-000000000011'::uuid, -20.9268, 55.3355), -- EHPAD Les Lataniers (La Possession)
  ('66666666-0000-0000-0000-000000000012'::uuid, -21.2795, 55.5170), -- EHPAD Les Mascareignes (Le Tampon)
  ('66666666-0000-0000-0000-000000000013'::uuid, -20.8905, 55.4520), -- EHPAD Albert Barbot (Saint-Denis)
  ('66666666-0000-0000-0000-000000000014'::uuid, -21.3418, 55.4795), -- EHPAD Les Alizés (Saint-Pierre)
  ('66666666-0000-0000-0000-000000000015'::uuid, -20.9070, 55.6085), -- EHPAD Les Tamarins (Sainte-Suzanne)
  ('66666666-0000-0000-0000-000000000016'::uuid, -20.8792, 55.4498), -- Cabinet kiné SD Centre
  ('66666666-0000-0000-0000-000000000017'::uuid, -21.3406, 55.4788), -- Cabinet kiné Saint-Pierre
  ('66666666-0000-0000-0000-000000000018'::uuid, -21.0110, 55.2698), -- Cabinet kiné Saint-Paul
  ('66666666-0000-0000-0000-000000000019'::uuid, -20.8801, 55.4521), -- Cabinet ophtalmo Saint-Denis
  ('66666666-0000-0000-0000-000000000020'::uuid, -21.3389, 55.4801), -- Cabinet ophtalmo Saint-Pierre
  ('66666666-0000-0000-0000-000000000021'::uuid, -20.8809, 55.4487), -- Cabinet dentaire Saint-Denis
  ('66666666-0000-0000-0000-000000000022'::uuid, -21.2800, 55.5150), -- Cabinet dentaire Le Tampon
  ('66666666-0000-0000-0000-000000000023'::uuid, -20.8890, 55.4472), -- Cabinet médecine Bellepierre (Saint-Denis)
  ('66666666-0000-0000-0000-000000000024'::uuid, -21.3412, 55.4791), -- Cabinet médecine Saint-Pierre
  ('66666666-0000-0000-0000-000000000025'::uuid, -21.2775, 55.5165), -- Cabinet médecine Le Tampon
  ('66666666-0000-0000-0000-000000000026'::uuid, -20.8815, 55.4505), -- Centre imagerie Saint-Denis
  ('66666666-0000-0000-0000-000000000027'::uuid, -21.3395, 55.4779), -- Labo Réunion Bio (Saint-Pierre)
  ('66666666-0000-0000-0000-000000000028'::uuid, -21.0098, 55.2705), -- Centre radio Saint-Paul
  ('66666666-0000-0000-0000-000000000029'::uuid, -21.3785, 55.6205), -- Foyer Les Hibiscus (Saint-Joseph)
  ('66666666-0000-0000-0000-000000000030'::uuid, -20.8968, 55.5490)  -- Pharmacie de l'Océan (Sainte-Marie)
) as c(id, lat, lng)
where p.id = c.id;

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

-- DEC-075 : aucune position GPS de chauffeur n'est captée, stockée ni suivie
-- avant HDS (donnée de santé indirecte ; RGPD géoloc salarié). Les positions
-- chauffeurs fictives « DÉMO » de l'ancien prototype géoloc (DEC-096) présentaient
-- du faux GPS comme un suivi réel — trompe-l'œil retiré. La carte du cockpit
-- affiche désormais uniquement les points et trajets des courses du jour (adresses
-- opérationnelles). On PURGE ici les positions démo résiduelles pour que les
-- previews déjà seedées ne conservent aucune position fictive (idempotent).
delete from public.driver_positions
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and source = 'demo';

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

-- =============================================================================
-- SEED-02 — Volume jusqu'à la cible VIS-03 + écrans vivants + multi-sociétés.
-- =============================================================================
-- Objectif : exercer CHAQUE écran en navigation (démo + recette manuelle).
-- Cible documentée (REQUIREMENTS VIS-03/VIS-05) : 3 sociétés, 6 chauffeurs,
-- ~30 patients (visibles dans /patients de la société de démo), ~50
-- prescriptions, ~200 courses passées ; écrans météo / replanification /
-- cockpit non vides.
--
-- Toutes données FICTIVES 974. Idempotent (IDs déterministes + ON CONFLICT).
-- Dates glissantes (relatives à now()/current_date) préservées.
--
-- DÉPENDANCES DE SCHÉMA NOTÉES (non ajoutées — ce lot PEUPLE, ne migre pas) :
--   • Aucune colonne « société multi-régulateur simultané » : le multi-société
--     est porté par organization_id + comptes distincts (seed.sql), suffisant.
--   • Réaffectation : pas de colonne d'état « en cours de réaffectation » — la
--     matière de /replanification vient d'un incident ouvert + courses futures
--     du chauffeur en panne (déduites au runtime), pas d'un flag stocké.
-- Préfixes IDs : patients société 1 = 11111111-…011..030 ; sociétés 2/3 =
--   …201.. / …301.. ; prescriptions générées = 88888888-…100.. ; courses
--   historiques générées = 44444444-…100..264 ; exceptions cockpit = …080..085 ;
--   météo = 12121212-… ; incident = 13131313-… .
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Société 1 — 20 patients supplémentaires (→ 30 au total, cible VIS-05)
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
begin
  insert into public.patients (
    id, organization_id, prenom, nom, date_naissance, genre,
    telephone, telephone_normalized, adresse_ligne1, code_postal, ville,
    canal_contact_prefere, consentement_sms, consentement_sms_at,
    archive, created_at, updated_at, created_by, updated_by
  ) values
    ('11111111-0000-0000-0000-000000000011', org_id, 'Willy', 'Técher', '1951-04-11', 'M',
     '06 92 99 00 11', '0692990011', '11 Rue du Marché', '97440', 'Saint-André', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000012', org_id, 'Nadia', 'Fontaine', '1963-09-27', 'F',
     '02 62 99 00 12', '0262990012', '12 Allée des Filaos', '97460', 'Saint-Paul', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000013', org_id, 'Steve', 'Rivière', '1978-01-05', 'M',
     '06 92 99 00 13', '0692990013', '13 Rue Hubert Delisle', '97430', 'Le Tampon', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000014', org_id, 'Josée', 'Lauret', '1946-11-19', 'F',
     '02 62 99 00 14', '0262990014', '14 Chemin Canal', '97450', 'Saint-Louis', 'aucun', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000015', org_id, 'Daniel', 'Gonthier', '1959-06-30', 'M',
     '06 92 99 00 15', '0692990015', '15 Rue de l''Église', '97470', 'Saint-Benoît', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000016', org_id, 'Marie-Thérèse', 'Turpin', '1954-03-08', 'F',
     '02 62 99 00 16', '0262990016', '16 Route de Duparc', '97438', 'Sainte-Marie', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000017', org_id, 'Émile', 'Nativel', '1943-07-22', 'M',
     '06 92 99 00 17', '0692990017', '17 Rue du Stade', '97441', 'Sainte-Suzanne', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000018', org_id, 'Sylviane', 'Cadet', '1967-12-14', 'F',
     '02 62 99 00 18', '0262990018', '18 Quai Ouest', '97420', 'Le Port', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000019', org_id, 'Roland', 'Ledoux', '1950-02-02', 'M',
     '06 92 99 00 19', '0692990019', '19 Rue Sainte-Thérèse', '97419', 'La Possession', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000020', org_id, 'Fabienne', 'Vienne', '1972-08-09', 'F',
     '02 62 99 00 20', '0262990020', '20 Chemin Bras-Panon', '97412', 'Bras-Panon', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000021', org_id, 'Georges', 'Sery', '1948-05-16', 'M',
     '06 92 99 00 21', '0692990021', '21 Rue de la Plage', '97429', 'Petite-Île', 'aucun', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000022', org_id, 'Monique', 'Barret', '1961-10-25', 'F',
     '02 62 99 00 22', '0262990022', '22 Route de la Plaine', '97480', 'Saint-Joseph', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000023', org_id, 'Alain', 'Ponama', '1957-01-30', 'M',
     '06 92 99 00 23', '0692990023', '23 Rue du Sel', '97427', 'L''Étang-Salé', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000024', org_id, 'Huguette', 'Élisabeth', '1944-04-04', 'F',
     '02 62 99 00 24', '0262990024', '24 Rue des Avirons', '97425', 'Les Avirons', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000025', org_id, 'Jean-Claude', 'Sinaman', '1969-11-11', 'M',
     '06 92 99 00 25', '0692990025', '25 Chemin Entre-Deux', '97414', 'Entre-Deux', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000026', org_id, 'Brigitte', 'Hoareau', '1976-06-18', 'F',
     '02 62 99 00 26', '0262990026', '26 Route de Sainte-Rose', '97439', 'Sainte-Rose', 'appel', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000027', org_id, 'Maxime', 'Ah-Nieme', '1952-09-01', 'M',
     '06 92 99 00 27', '0692990027', '27 Rue du Cirque', '97413', 'Cilaos', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000028', org_id, 'Corinne', 'Fruteau', '1965-03-23', 'F',
     '02 62 99 00 28', '0262990028', '28 Rue François de Mahy', '97410', 'Saint-Pierre', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000029', org_id, 'Patrice', 'Legros', '1940-12-07', 'M',
     '06 92 99 00 29', '0692990029', '29 Rue Jean Chatel', '97400', 'Saint-Denis', 'aucun', false, null, false, now(), now(), regulateur_id, regulateur_id),
    ('11111111-0000-0000-0000-000000000030', org_id, 'Sabine', 'Vitry', '1974-07-13', 'F',
     '02 62 99 00 30', '0262990030', '30 Route de Bois-de-Nèfles', '97490', 'Sainte-Clotilde', 'sms', true, now(), false, now(), now(), regulateur_id, regulateur_id)
  on conflict (id) do nothing;

  raise notice 'SEED-02 : 20 patients société 1 supplementaires (total 30)';
end$$;

-- -----------------------------------------------------------------------------
-- Société 1 — ~44 prescriptions générées (→ ~50 avec l'existant) + variété
-- (active / série / proche échéance / expirée), réparties sur les 30 patients.
-- -----------------------------------------------------------------------------
-- trajets_consommes / statut : statut posé à l'insert (aucune course
-- consommatrice rattachée à ces bons générés → le trigger de comptage ne les
-- touche pas), NON réinitialisé au ré-seed (mêmes règles que SEED-01).
do $$
declare
  org_id         uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id  uuid := '00000000-0000-0000-0000-000000000020';
  prescriber_ids uuid[] := array[
    '55555555-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000002',
    '55555555-0000-0000-0000-000000000003']::uuid[];
  motifs text[] := array[
    'Dialyse itérative', 'Séances de kinésithérapie',
    'Consultation de suivi spécialisé', 'Cure de chimiothérapie',
    'Transport post-hospitalisation', 'Rééducation fonctionnelle',
    'Consultation ophtalmologique', 'Soins de néphrologie'];
  modes text[] := array['taxi_conventionne', 'tpmr', 'vsl'];
  patient_ids uuid[];
  np int;
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  np := array_length(patient_ids, 1);
  if np is null or np < 30 then
    raise notice 'SEED-02 prescriptions : moins de 30 patients, bloc ignoré.';
    return;
  end if;

  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, numero, date_prescription,
    motif, type_transport, trajets_autorises, date_expiration, statut, created_by
  )
  select
    ('88888888-0000-0000-0000-' || lpad((100 + g)::text, 12, '0'))::uuid,
    org_id,
    patient_ids[1 + (g % np)],
    prescriber_ids[1 + (g % 3)],
    'BT-DEMO-GEN-' || lpad((100 + g)::text, 4, '0'),
    current_date - (10 + (g % 200)),
    motifs[1 + (g % array_length(motifs, 1))],
    modes[1 + (g % 3)],
    4 + (g % 26),
    case
      when g % 10 = 0 then current_date - (5 + (g % 20))     -- expirée
      when g % 10 = 1 then current_date + (3 + (g % 4))      -- proche échéance
      else current_date + (60 + (g % 120))                  -- confortable
    end,
    (case when g % 10 = 0 then 'expiree' else 'active' end)::public.prescription_status,
    regulateur_id
  from generate_series(0, 43) as g
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    prescriber_id = excluded.prescriber_id,
    numero = excluded.numero,
    date_prescription = excluded.date_prescription,
    motif = excluded.motif,
    type_transport = excluded.type_transport,
    trajets_autorises = excluded.trajets_autorises,
    date_expiration = excluded.date_expiration;

  raise notice 'SEED-02 : 44 prescriptions générées société 1 (variété active/expirée/proche échéance)';
end$$;

-- -----------------------------------------------------------------------------
-- Société 1 — 165 courses historiques générées (→ ~200 avec l'existant)
-- Toutes terminées + tarifées, réparties sur ~88 jours (KPIs, historique,
-- pagination /courses). ~1/6 encaissées (caisse) ; le reste tiers payant CGSS.
-- Dates glissantes (relatives à now()). Reset exhaustif au ré-seed.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  driver_ids  uuid[] := array[
    '22222222-0000-0000-0000-000000000011',
    '22222222-0000-0000-0000-000000000012',
    '22222222-0000-0000-0000-000000000013']::uuid[];
  vehicle_ids uuid[] := array[
    '33333333-0000-0000-0000-000000000011',
    '33333333-0000-0000-0000-000000000012',
    '33333333-0000-0000-0000-000000000013']::uuid[];
  modes public.ride_transport_mode[] := array['taxi_conventionne', 'tpmr', 'vsl']::public.ride_transport_mode[];
  methods text[] := array['cash', 'cb', 'cheque'];
  pickups text[] := array[
    '12 Rue de Paris, 97400 Saint-Denis',
    '45 Avenue de la République, 97410 Saint-Pierre',
    '8 Chemin des Frangipaniers, 97419 La Possession',
    '23 Rue Maréchal Leclerc, 97400 Saint-Denis',
    'Résidence Les Mascareignes, 97432 Ravine-des-Cabris',
    'EHPAD Les Lataniers, 97419 La Possession',
    '17 Rue Sainte-Anne, 97410 Saint-Pierre',
    '5 Boulevard Lacaussade, 97400 Saint-Denis'];
  dropoffs text[] := array[
    'CHU Félix Guyon, 97400 Saint-Denis',
    'Centre de dialyse Sud, 97410 Saint-Pierre',
    'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
    'Clinique Saint-Vincent, 97400 Saint-Denis',
    'Centre de rééducation, 97430 Le Tampon',
    'Cabinet médical, 97460 Saint-Paul',
    'Centre de dialyse Nord, 97400 Saint-Denis',
    'Laboratoire d''analyses, 97490 Sainte-Clotilde'];
  patient_ids uuid[];
  np int;
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  np := array_length(patient_ids, 1);
  if np is null or np < 30 then
    raise notice 'SEED-02 courses historiques : moins de 30 patients, bloc ignoré.';
    return;
  end if;

  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    created_at, created_by, updated_by
  )
  select
    ('44444444-0000-0000-0000-' || lpad((100 + g)::text, 12, '0'))::uuid,
    org_id,
    patient_ids[1 + (g % np)],
    driver_ids[1 + (g % 3)],
    vehicle_ids[1 + (g % 3)],
    pickups[1 + (g % 8)],
    dropoffs[1 + (g % 8)],
    sched.scheduled_at,
    'terminee', modes[1 + (g % 3)], 'programmee',
    sched.scheduled_at + interval '5 minutes',
    sched.scheduled_at + interval '5 minutes' + ((20 + (g % 60)) || ' minutes')::interval,
    ((15 + (g % 45))::numeric + 0.50),
    'manuel',
    case when g % 6 = 0 then 'encaisse' else 'non_concerne' end,
    case when g % 6 = 0 then methods[1 + (g % 3)] else null end,
    case when g % 6 = 0
      then sched.scheduled_at + interval '5 minutes' + ((20 + (g % 60)) || ' minutes')::interval
      else null end,
    sched.scheduled_at - interval '1 day',
    regulateur_id, regulateur_id
  from generate_series(0, 164) as g
  cross join lateral (
    select date_trunc('day', now())
      - ((1 + (g % 88)) || ' days')::interval
      + ((7 + (g % 10)) || ' hours')::interval as scheduled_at
  ) as sched
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur,
    tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status,
    payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at,
    created_at = excluded.created_at,
    archive = false, cancel_motif = null, notes_regulateur = null;

  raise notice 'SEED-02 : 165 courses historiques générées société 1 (dont ~1/6 encaissées)';
end$$;

-- -----------------------------------------------------------------------------
-- Écrans vivants — météo (alerte active) + replanification (incident ouvert)
-- + cockpit (retard / absence patient / urgence). Société 1.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id        uuid := '00000000-0000-0000-0000-000000000001';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  vergoz_id     uuid := '22222222-0000-0000-0000-000000000011';
  maillot_id    uuid := '22222222-0000-0000-0000-000000000012';
  boyer_id      uuid := '22222222-0000-0000-0000-000000000013';
  vehicle_dacia uuid := '33333333-0000-0000-0000-000000000011';
  vehicle_master uuid := '33333333-0000-0000-0000-000000000012';
  patient_ids uuid[];
begin
  select array_agg(id order by nom) into patient_ids
    from public.patients where organization_id = org_id and archive = false;
  if patient_ids is null or array_length(patient_ids, 1) < 10 then
    raise notice 'SEED-02 écrans vivants : moins de 10 patients, bloc ignoré.';
    return;
  end if;

  -- Météo : une alerte ACTIVE (bandeau cockpit + écran /meteo démontrables).
  insert into public.weather_alerts (id, organization_id, active, motif, zone, activated_by, activated_at)
  values ('12121212-0000-0000-0000-000000000001', org_id, true,
          'Vigilance cyclonique orange (démo) — anticiper annulations dialyse', 'Nord et Est',
          regulateur_id, now() - interval '3 hours')
  on conflict (id) do update set
    active = true, motif = excluded.motif, zone = excluded.zone,
    activated_by = excluded.activated_by, activated_at = excluded.activated_at,
    deactivated_at = null;

  -- Replanification : un incident OUVERT (panne) sur Boyer → ses courses futures
  -- deviennent réaffectables sur /replanification.
  insert into public.driver_incidents (id, organization_id, driver_id, type, nature, lieu, started_at, created_by)
  values ('13131313-0000-0000-0000-000000000001', org_id, boyer_id, 'panne_vehicule',
          'Voyant moteur allumé + perte de puissance', 'RN2 hauteur Sainte-Marie',
          now() - interval '40 minutes', regulateur_id)
  on conflict (id) do update set
    type = excluded.type, nature = excluded.nature, lieu = excluded.lieu,
    started_at = excluded.started_at, resolved_at = null;

  -- Cockpit : cas d'exception (retard / absence patient / urgence) + du nominal.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    no_show_at, no_show_motif, cancel_motif,
    created_at, created_by, updated_by
  ) values
    -- Retard : course assignée dont l'heure est déjà passée, non démarrée.
    ('44444444-0000-0000-0000-000000000080', org_id, patient_ids[3], vergoz_id, vehicle_dacia,
     '12 Rue de Paris, 97400 Saint-Denis', 'CHU Félix Guyon, 97400 Saint-Denis',
     now() - interval '75 minutes', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, now() - interval '5 hours', regulateur_id, regulateur_id),
    -- Absence patient : no-show du jour.
    ('44444444-0000-0000-0000-000000000081', org_id, patient_ids[4], maillot_id, vehicle_dacia,
     '45 Avenue de la République, 97410 Saint-Pierre', 'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '8 hours', 'annulee_patient', 'taxi_conventionne', 'programmee',
     now() - interval '30 minutes', 'Patient absent au point de rendez-vous (3 appels sans réponse).',
     'Absence patient (no-show)', now() - interval '6 hours', regulateur_id, regulateur_id),
    -- Urgence immédiate non affectée (à traiter).
    ('44444444-0000-0000-0000-000000000082', org_id, patient_ids[5], null, null,
     'CHU Félix Guyon, 97400 Saint-Denis', 'Clinique Sainte-Clotilde, 97490 Saint-Denis',
     now() + interval '45 minutes', 'validee', 'taxi_conventionne', 'immediate',
     null, null, null, now() - interval '10 minutes', regulateur_id, regulateur_id),
    -- Urgence programmée urgente, affectée (Boyer — recoupe l'incident ci-dessus).
    ('44444444-0000-0000-0000-000000000083', org_id, patient_ids[6], boyer_id, vehicle_master,
     'EHPAD Les Lataniers, 97419 La Possession', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     now() + interval '2 hours', 'assignee', 'tpmr', 'urgente',
     null, null, null, now() - interval '20 minutes', regulateur_id, regulateur_id)
  on conflict (id) do update set
    patient_id = excluded.patient_id,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    pickup_address = excluded.pickup_address,
    dropoff_address = excluded.dropoff_address,
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    transport_mode = excluded.transport_mode,
    urgency = excluded.urgency,
    started_at = null, ended_at = null,
    tarif_amount_eur = null, tarif_source = null,
    payment_status = 'non_concerne', payment_method = null, payment_received_at = null,
    no_show_at = excluded.no_show_at, no_show_motif = excluded.no_show_motif,
    cancel_motif = excluded.cancel_motif,
    archive = false, notes_regulateur = null;

  raise notice 'SEED-02 : écrans vivants société 1 (météo active + incident ouvert + 4 exceptions cockpit)';
end$$;

-- -----------------------------------------------------------------------------
-- Sociétés 2 et 3 — référentiels isolés (patients, chauffeurs, véhicules,
-- prescripteurs, prescriptions, courses). Démontrent l'ISOLATION : chaque
-- donnée porte l'organization_id de sa société, created_by = un compte de
-- cette société. 6 chauffeurs au total (3 société 1 + 2 société 2 + 1 société 3).
-- -----------------------------------------------------------------------------
do $$
declare
  -- Société 2
  org2  uuid := '00000000-0000-0000-0000-000000000002';
  dir2  uuid := '00000000-0000-0000-0000-000000000210';
  reg2  uuid := '00000000-0000-0000-0000-000000000220';
  prof2a uuid := '00000000-0000-0000-0000-000000000230';
  prof2b uuid := '00000000-0000-0000-0000-000000000231';
  -- Société 3
  org3  uuid := '00000000-0000-0000-0000-000000000003';
  dir3  uuid := '00000000-0000-0000-0000-000000000310';
  reg3  uuid := '00000000-0000-0000-0000-000000000320';
  prof3a uuid := '00000000-0000-0000-0000-000000000330';
begin
  -- Patients société 2 (6) et société 3 (4).
  insert into public.patients (
    id, organization_id, prenom, nom, date_naissance, genre,
    telephone, telephone_normalized, adresse_ligne1, code_postal, ville,
    canal_contact_prefere, consentement_sms, consentement_sms_at,
    archive, created_at, updated_at, created_by, updated_by
  ) values
    ('11111111-0000-0000-0000-000000000201', org2, 'Yolande', 'Grondin', '1953-02-17', 'F',
     '02 62 35 00 01', '0262350001', '1 Rue Augustin Archambaud', '97410', 'Saint-Pierre', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000202', org2, 'Bruno', 'Hoarau', '1961-05-29', 'M',
     '06 92 35 00 02', '0692350002', '2 Rue François de Mahy', '97410', 'Saint-Pierre', 'appel', false, null, false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000203', org2, 'Isabelle', 'Payet', '1970-08-03', 'F',
     '02 62 27 00 03', '0262270003', '3 Rue Hubert Delisle', '97430', 'Le Tampon', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000204', org2, 'Serge', 'Dijoux', '1948-10-21', 'M',
     '06 92 27 00 04', '0692270004', '4 Rue du Général de Gaulle', '97430', 'Le Tampon', 'aucun', false, null, false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000205', org2, 'Nathalie', 'Robert', '1966-12-09', 'F',
     '02 62 35 00 05', '0262350005', '5 Boulevard Hubert Delisle', '97410', 'Saint-Pierre', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000206', org2, 'Thierry', 'Lebon', '1957-03-14', 'M',
     '06 92 29 00 06', '0692290006', '6 Rue de la Plage', '97429', 'Petite-Île', 'sms', true, now(), false, now(), now(), reg2, reg2),
    ('11111111-0000-0000-0000-000000000301', org3, 'Ginette', 'Maillot', '1951-07-07', 'F',
     '02 62 45 00 01', '0262450001', '1 Rue de la Compagnie', '97460', 'Saint-Paul', 'sms', true, now(), false, now(), now(), reg3, reg3),
    ('11111111-0000-0000-0000-000000000302', org3, 'Pascal', 'Boyer', '1963-11-30', 'M',
     '06 92 45 00 02', '0692450002', '2 Route du Théâtre', '97460', 'Saint-Paul', 'appel', false, null, false, now(), now(), reg3, reg3),
    ('11111111-0000-0000-0000-000000000303', org3, 'Sandrine', 'Vergoz', '1975-04-25', 'F',
     '02 62 42 00 03', '0262420003', '3 Rue Jeanne d''Arc', '97420', 'Le Port', 'sms', true, now(), false, now(), now(), reg3, reg3),
    ('11111111-0000-0000-0000-000000000304', org3, 'Michel', 'Bègue', '1945-09-12', 'M',
     '06 92 42 00 04', '0692420004', '4 Quai Ouest', '97420', 'Le Port', 'aucun', false, null, false, now(), now(), reg3, reg3)
  on conflict (id) do nothing;

  -- Chauffeurs (2 + 1) et véhicules (2 + 1).
  insert into public.drivers (
    id, organization_id, profile_id, nom_affichage, telephone, numero_licence, type_permis, actif, created_by
  ) values
    ('22222222-0000-0000-0000-000000000021', org2, prof2a, 'Técher Willy', '0692350021', 'LIC-974-021', '{taxi}'::text[], true, dir2),
    ('22222222-0000-0000-0000-000000000022', org2, prof2b, 'Fontaine Nadia', '0692350022', 'LIC-974-022', '{taxi,tpmr}'::text[], true, dir2),
    ('22222222-0000-0000-0000-000000000031', org3, prof3a, 'Rivière Steve', '0692450031', 'LIC-974-031', '{taxi}'::text[], true, dir3)
  on conflict (id) do update set profile_id = excluded.profile_id;

  insert into public.vehicles (
    id, organization_id, immatriculation, marque, modele, type, places_assises, places_tpmr, actif, created_by
  ) values
    ('33333333-0000-0000-0000-000000000021', org2, 'MN-021-OP', 'Dacia', 'Jogger', 'taxi_conventionne', 4, null, true, dir2),
    ('33333333-0000-0000-0000-000000000022', org2, 'QR-022-ST', 'Renault', 'Trafic', 'tpmr', 6, 1, true, dir2),
    ('33333333-0000-0000-0000-000000000031', org3, 'UV-031-WX', 'Citroën', 'SpaceTourer', 'vsl', 3, null, true, dir3)
  on conflict (id) do nothing;

  -- Prescripteurs (1 + 1).
  insert into public.prescribers (id, organization_id, nom, prenom, type, rpps, specialite, actif, created_by)
  values
    ('55555555-0000-0000-0000-000000000021', org2, 'Hoarau', 'Denis', 'medecin', '10000000021', 'Médecine générale', true, reg2),
    ('55555555-0000-0000-0000-000000000031', org3, 'Payet', 'Sylvie', 'medecin', '10000000031', 'Néphrologie', true, reg3)
  on conflict (id) do update set nom = excluded.nom, prenom = excluded.prenom, type = excluded.type,
    rpps = excluded.rpps, specialite = excluded.specialite, actif = excluded.actif, archive = false, archive_at = null;

  -- Prescriptions (3 société 2 + 2 société 3).
  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, numero, date_prescription,
    motif, type_transport, trajets_autorises, date_expiration, statut, created_by
  ) values
    ('88888888-0000-0000-0000-000000000201', org2, '11111111-0000-0000-0000-000000000201', '55555555-0000-0000-0000-000000000021',
     'BT-B-2026-0001', current_date - 25, 'Dialyse itérative', 'taxi_conventionne', 20, current_date + 90, 'active', reg2),
    ('88888888-0000-0000-0000-000000000202', org2, '11111111-0000-0000-0000-000000000203', '55555555-0000-0000-0000-000000000021',
     'BT-B-2026-0002', current_date - 12, 'Consultation de suivi', 'taxi_conventionne', 4, current_date + 150, 'active', reg2),
    ('88888888-0000-0000-0000-000000000203', org2, '11111111-0000-0000-0000-000000000205', '55555555-0000-0000-0000-000000000021',
     'BT-B-2025-0009', current_date - 200, 'Cure thermale', 'tpmr', 6, current_date - 20, 'expiree', reg2),
    ('88888888-0000-0000-0000-000000000301', org3, '11111111-0000-0000-0000-000000000301', '55555555-0000-0000-0000-000000000031',
     'BT-C-2026-0001', current_date - 18, 'Séances de kinésithérapie', 'taxi_conventionne', 10, current_date + 5, 'active', reg3),
    ('88888888-0000-0000-0000-000000000302', org3, '11111111-0000-0000-0000-000000000303', '55555555-0000-0000-0000-000000000031',
     'BT-C-2026-0002', current_date - 8, 'Soins de néphrologie', 'taxi_conventionne', 20, current_date + 120, 'active', reg3)
  on conflict (id) do update set
    patient_id = excluded.patient_id, prescriber_id = excluded.prescriber_id, numero = excluded.numero,
    date_prescription = excluded.date_prescription, motif = excluded.motif, type_transport = excluded.type_transport,
    trajets_autorises = excluded.trajets_autorises, date_expiration = excluded.date_expiration;

  -- Courses (6 société 2 + 4 société 3) : historiques terminées + du jour, pour
  -- que les cockpits/listes/facturation de ces sociétés ne soient pas vides.
  insert into public.rides (
    id, organization_id, patient_id, driver_id, vehicle_id,
    pickup_address, dropoff_address, scheduled_at, status, transport_mode, urgency,
    started_at, ended_at, tarif_amount_eur, tarif_source,
    payment_status, payment_method, payment_received_at,
    created_at, created_by, updated_by
  ) values
    ('44444444-0000-0000-0000-000000000301', org2, '11111111-0000-0000-0000-000000000201', '22222222-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000021',
     '1 Rue Augustin Archambaud, 97410 Saint-Pierre', 'Centre de dialyse Sud, 97410 Saint-Pierre',
     date_trunc('day', now() - interval '2 days') + interval '7 hours', 'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '2 days') + interval '7 hours 5 minutes', date_trunc('day', now() - interval '2 days') + interval '7 hours 30 minutes',
     19.00, 'manuel', 'non_concerne', null, null, now() - interval '2 days', reg2, reg2),
    ('44444444-0000-0000-0000-000000000302', org2, '11111111-0000-0000-0000-000000000202', '22222222-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000022',
     '2 Rue François de Mahy, 97410 Saint-Pierre', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now() - interval '1 day') + interval '10 hours', 'terminee', 'tpmr', 'programmee',
     date_trunc('day', now() - interval '1 day') + interval '10 hours 5 minutes', date_trunc('day', now() - interval '1 day') + interval '11 hours',
     41.00, 'manuel', 'encaisse', 'cb', date_trunc('day', now() - interval '1 day') + interval '11 hours', now() - interval '1 day', reg2, reg2),
    ('44444444-0000-0000-0000-000000000303', org2, '11111111-0000-0000-0000-000000000203', '22222222-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000021',
     '3 Rue Hubert Delisle, 97430 Le Tampon', 'Dialyse Sud Le Tampon, 97430 Le Tampon',
     date_trunc('day', now()) + interval '8 hours', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '4 hours', reg2, reg2),
    ('44444444-0000-0000-0000-000000000304', org2, '11111111-0000-0000-0000-000000000205', '22222222-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000022',
     '5 Boulevard Hubert Delisle, 97410 Saint-Pierre', 'Cabinet de kinésithérapie, 97410 Saint-Pierre',
     date_trunc('day', now()) + interval '14 hours', 'validee', 'tpmr', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '3 hours', reg2, reg2),
    ('44444444-0000-0000-0000-000000000305', org2, '11111111-0000-0000-0000-000000000204', '22222222-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000021',
     '4 Rue du Général de Gaulle, 97430 Le Tampon', 'Laboratoire, 97410 Saint-Pierre',
     date_trunc('day', now() + interval '1 day') + interval '9 hours', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '2 hours', reg2, reg2),
    ('44444444-0000-0000-0000-000000000306', org2, '11111111-0000-0000-0000-000000000206', '22222222-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000022',
     '6 Rue de la Plage, 97429 Petite-Île', 'CHU Sud Saint-Pierre, 97448 Saint-Pierre',
     date_trunc('day', now() - interval '5 days') + interval '13 hours', 'terminee', 'tpmr', 'programmee',
     date_trunc('day', now() - interval '5 days') + interval '13 hours 5 minutes', date_trunc('day', now() - interval '5 days') + interval '14 hours',
     45.00, 'manuel', 'non_concerne', null, null, now() - interval '5 days', reg2, reg2),
    ('44444444-0000-0000-0000-000000000321', org3, '11111111-0000-0000-0000-000000000301', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '1 Rue de la Compagnie, 97460 Saint-Paul', 'CH Gabriel Martin, 97460 Saint-Paul',
     date_trunc('day', now() - interval '1 day') + interval '9 hours', 'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '1 day') + interval '9 hours 5 minutes', date_trunc('day', now() - interval '1 day') + interval '9 hours 40 minutes',
     23.00, 'manuel', 'encaisse', 'cash', date_trunc('day', now() - interval '1 day') + interval '9 hours 40 minutes', now() - interval '1 day', reg3, reg3),
    ('44444444-0000-0000-0000-000000000322', org3, '11111111-0000-0000-0000-000000000302', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '2 Route du Théâtre, 97460 Saint-Paul', 'Cabinet médical, 97460 Saint-Paul',
     date_trunc('day', now()) + interval '10 hours', 'assignee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '3 hours', reg3, reg3),
    ('44444444-0000-0000-0000-000000000323', org3, '11111111-0000-0000-0000-000000000303', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '3 Rue Jeanne d''Arc, 97420 Le Port', 'Clinique Jeanne d''Arc, 97420 Le Port',
     date_trunc('day', now()) + interval '15 hours', 'validee', 'taxi_conventionne', 'programmee',
     null, null, null, 'manuel', 'non_concerne', null, null, now() - interval '1 hour', reg3, reg3),
    ('44444444-0000-0000-0000-000000000324', org3, '11111111-0000-0000-0000-000000000304', '22222222-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000031',
     '4 Quai Ouest, 97420 Le Port', 'CHU Félix Guyon, 97400 Saint-Denis',
     date_trunc('day', now() - interval '3 days') + interval '8 hours', 'terminee', 'taxi_conventionne', 'programmee',
     date_trunc('day', now() - interval '3 days') + interval '8 hours 5 minutes', date_trunc('day', now() - interval '3 days') + interval '9 hours 15 minutes',
     33.00, 'manuel', 'non_concerne', null, null, now() - interval '3 days', reg3, reg3)
  on conflict (id) do update set
    patient_id = excluded.patient_id, driver_id = excluded.driver_id, vehicle_id = excluded.vehicle_id,
    pickup_address = excluded.pickup_address, dropoff_address = excluded.dropoff_address,
    scheduled_at = excluded.scheduled_at, status = excluded.status, transport_mode = excluded.transport_mode,
    urgency = excluded.urgency, started_at = excluded.started_at, ended_at = excluded.ended_at,
    tarif_amount_eur = excluded.tarif_amount_eur, tarif_source = excluded.tarif_source,
    payment_status = excluded.payment_status, payment_method = excluded.payment_method,
    payment_received_at = excluded.payment_received_at, created_at = excluded.created_at,
    archive = false, cancel_motif = null, notes_regulateur = null;

  raise notice 'SEED-02 : sociétés 2 et 3 (10 patients, 3 chauffeurs, 3 véhicules, 2 prescripteurs, 5 prescriptions, 10 courses)';
end$$;

-- =============================================================================
-- Coordonnées des AUTRES courses `validee` J0 (hors bloc « Ma journée »)
-- =============================================================================
-- Le bloc des courses du jour affichées (org1) est géocodé EN PLACE plus haut
-- (« 4 courses du jour (J0) »), et le bloc doublon ajouté à côté a été retiré :
-- il ne reste qu'un seul jeu de courses du jour. On complète ici seulement les
-- courses `validee` J0 des AUTRES écrans / sociétés — ...0082 (org1, exceptions
-- cockpit), ...0304 (société 2), ...0323 (société 3) — pour qu'aucune ne soit
-- exclue faute de coordonnées. Coordonnées EN DUR, idempotent.
update public.rides
  set pickup_lat = -20.8895, pickup_lng = 55.4468, dropoff_lat = -20.9083, dropoff_lng = 55.4808
  where id = '44444444-0000-0000-0000-000000000082'; -- org1 : CHU Félix Guyon → Clinique Sainte-Clotilde
update public.rides
  set pickup_lat = -21.3410, pickup_lng = 55.4790, dropoff_lat = -21.3406, dropoff_lng = 55.4788
  where id = '44444444-0000-0000-0000-000000000304'; -- org2 : Saint-Pierre → cabinet kiné Saint-Pierre
update public.rides
  set pickup_lat = -20.9390, pickup_lng = 55.2935, dropoff_lat = -20.9385, dropoff_lng = 55.2938
  where id = '44444444-0000-0000-0000-000000000323'; -- org3 : Le Port → Clinique Jeanne d'Arc

-- ============================================================================
-- SEED-CHECK — auto-vérification de fiabilité (démo société 1)
-- ----------------------------------------------------------------------------
-- Le bloc « écrans vivants » (SEED-02) insère notamment 2 courses d'urgence
-- (immédiate non affectée + urgente affectée), indispensables pour démontrer le
-- filtre « Urgentes » de la page courses. Ce garde-fou vérifie qu'elles existent
-- réellement APRÈS seeding et lève une exception sinon : avec `ON_ERROR_STOP=1`
-- (CD), un seed silencieusement incomplet devient un échec BRUYANT au lieu de
-- passer inaperçu (incident constaté : 0 course urgente en base malgré le seed).
--
-- On ne vérifie l'invariant que si le bloc « écrans vivants » a dû s'exécuter
-- (>= 10 patients société 1) — même seuil que sa propre garde, pour ne pas
-- échouer sur un environnement volontairement minimal.
do $$
declare
  org_id       uuid := '00000000-0000-0000-0000-000000000001';
  nb_patients  int;
  nb_urgences  int;
begin
  select count(*) into nb_patients
    from public.patients where organization_id = org_id and archive = false;
  if nb_patients < 10 then
    raise notice 'SEED-CHECK : < 10 patients société 1 → vérification des urgences ignorée.';
    return;
  end if;

  select count(*) into nb_urgences
    from public.rides
    where organization_id = org_id and archive = false
      and urgency in ('urgente', 'immediate');

  if nb_urgences < 2 then
    raise exception
      'SEED-CHECK ÉCHEC : % course(s) urgente/immédiate en base (attendu >= 2, société 1). Le seed démo est incomplet — le filtre « Urgentes » ne remonterait rien.',
      nb_urgences;
  end if;

  raise notice 'SEED-CHECK OK : % courses urgentes/immédiates (société 1).', nb_urgences;
end$$;
