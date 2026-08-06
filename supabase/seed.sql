-- =============================================================================
-- Seed — Données de démonstration locales uniquement
-- =============================================================================
-- Crée 1 organization de démo + 5 comptes (dirigeant, régulateur, 3 chauffeurs).
-- À NE JAMAIS exécuter en production. Ce fichier est appliqué automatiquement
-- par `supabase db reset` en local.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organization de démo
-- -----------------------------------------------------------------------------
-- SEED-02 (VIS-03) : trois sociétés fictives pour éprouver l'isolation et le
-- volume. La société 1 reste la société de démonstration principale (comptes
-- @demo.tap historiques) ; les sociétés 2 et 3 servent à MONTRER l'isolation
-- (un régulateur d'une société ne voit jamais les données d'une autre).
insert into public.organizations (id, nom, siret, ville, code_postal, telephone, email)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'TAP Démo Réunion',
    '12345678901234',
    'Saint-Denis',
    '97400',
    '0262000000',
    'contact@demo.tap'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Transport Austral Sud',
    '39876543200021',
    'Saint-Pierre',
    '97410',
    '0262350000',
    'contact@transport-austral.demo'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Cita Ouest Réunion',
    null,
    'Saint-Paul',
    '97460',
    '0262450000',
    'contact@cita-ouest.demo'
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Comptes Auth + identités + profils
-- -----------------------------------------------------------------------------
-- Mot de passe : demo1234! (haché bcrypt via pgcrypto/crypt)
--
-- 3 inserts par compte (ordre IMPORTANT) :
--   1. auth.users           — identifiant + mot de passe
--   2. auth.identities      — REQUIS depuis GoTrue v2.x sinon
--                              signInWithPassword renvoie "Invalid login credentials"
--   3. public.profiles      — métier (organization_id, rôle)
--
-- Helper local pour éviter la duplication.
-- -----------------------------------------------------------------------------

create or replace function pg_temp.seed_demo_user(
  p_user_id uuid,
  p_email text,
  p_password text,
  p_org_id uuid,
  p_role text,
  p_prenom text,
  p_nom text
) returns void language plpgsql as $fn$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current,
    email_change, phone_change, phone_change_token,
    reauthentication_token
  )
  values (
    p_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', p_prenom, 'nom', p_nom),
    '', '', '', '', '', '', '', ''
  )
  on conflict (id) do update
    set encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at,
        updated_at = now();

  -- auth.identities — provider_id = user_id::text pour le provider 'email'.
  -- La colonne `id` a été ajoutée à auth.identities en 2024 (cloud Supabase).
  -- On la fournit systématiquement (gen_random_uuid) — sur les rares envs
  -- où elle n'existe pas, l'INSERT échouera proprement et le seed sera
  -- à relancer après upgrade GoTrue.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), p_user_id, p_user_id::text,
    jsonb_build_object('sub', p_user_id::text, 'email', p_email, 'email_verified', true),
    'email',
    now(), now(), now()
  )
  on conflict (provider, provider_id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (p_user_id, p_org_id, p_role::public.user_role, p_prenom, p_nom, p_email)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        prenom = excluded.prenom,
        nom = excluded.nom,
        email = excluded.email;
end
$fn$;

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000010',
    'dirigeant@demo.tap', 'demo1234!',
    org_id, 'dirigeant', 'Dirigeant', 'Démo'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000020',
    'regulateur@demo.tap', 'demo1234!',
    org_id, 'regulateur', 'Régulateur', 'Démo'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000030',
    'chauffeur@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Vergoz', 'Jean'
  );
  -- DEC-031 : UAT multi-chauffeurs. 2 comptes auth additionnels rattachés
  -- aux drivers Maillot et Boyer dans seed.demo.sql (profile_id non null).
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000031',
    'chauffeur2@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Maillot', 'André'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000032',
    'chauffeur3@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Boyer', 'Sophie'
  );
  -- Compte E2E (PLAN-1 helper loginAsRegulateur attend reg-demo@tap.test)
  perform pg_temp.seed_demo_user(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'reg-demo@tap.test', 'demo1234!',
    org_id, 'regulateur', 'E2E', 'Régulatrice'
  );

  -- SEED-02 : comptes des sociétés 2 et 3 (isolation démontrable). Même mot de
  -- passe demo1234!. Suffixes -b (société 2) / -c (société 3).
  -- Société 2 — Transport Austral Sud (dirigeant, régulateur, 2 chauffeurs).
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000210',
    'dirigeant-b@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'dirigeant', 'Dirigeant', 'Austral'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000220',
    'regulateur-b@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'regulateur', 'Régulateur', 'Austral'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000230',
    'chauffeur-b1@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'chauffeur', 'Técher', 'Willy'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000231',
    'chauffeur-b2@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000002', 'chauffeur', 'Fontaine', 'Nadia'
  );
  -- Société 3 — Cita Ouest Réunion (dirigeant, régulateur, 1 chauffeur).
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000310',
    'dirigeant-c@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000003', 'dirigeant', 'Dirigeant', 'Cita'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000320',
    'regulateur-c@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000003', 'regulateur', 'Régulateur', 'Cita'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000330',
    'chauffeur-c1@demo.tap', 'demo1234!',
    '00000000-0000-0000-0000-000000000003', 'chauffeur', 'Rivière', 'Steve'
  );
end
$$;

-- -----------------------------------------------------------------------------
-- Re-seed patients fictifs — défense en profondeur NFR-001 (D-SEED-1..4)
-- -----------------------------------------------------------------------------
-- Personnes FICTIVES (aucune correspondance réelle) mais adresses de domicile
-- RÉELLES et géocodables (résidences 974) : le départ d'un transport sanitaire
-- est le domicile du patient, et l'optimiseur a besoin de vrais points. Tél
-- 99-90-XX non attribués. Bloc UPDATE idempotent, mirroir de seed.demo.sql.
-- No-op si les patients démo ne sont pas encore semés (seed.sql s'exécute avant
-- seed.demo.sql) ; sinon réaligne sur les valeurs canoniques. Les noms sont
-- conservés (exception NFR-001 explicite pour les données de démo, Q3 phase 03.1).
-- -----------------------------------------------------------------------------

UPDATE public.patients SET telephone = '02 62 99 90 01', telephone_normalized = '0262999001',
  adresse_ligne1 = '12 Rue Sainte-Anne', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Bègue' AND prenom = 'Christiane';
UPDATE public.patients SET telephone = '02 62 99 90 02', telephone_normalized = '0262999002',
  adresse_ligne1 = '22 Rue Auguste Babet', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Boyer' AND prenom = 'Suzanne';
UPDATE public.patients SET telephone = '06 92 99 90 03', telephone_normalized = '0692999003',
  adresse_ligne1 = '15 Rue François de Mahy', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Dijoux' AND prenom = 'André';
UPDATE public.patients SET telephone = '06 92 99 90 04', telephone_normalized = '0692999004',
  adresse_ligne1 = '25 Rue de la Trinité', code_postal = '97490', ville = 'Sainte-Clotilde'
  WHERE nom = 'Grondin' AND prenom = 'Jean-Bernard';
UPDATE public.patients SET telephone = '06 92 99 90 05', telephone_normalized = '0692999005',
  adresse_ligne1 = '32 Rue Juliette Dodu', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Hoarau' AND prenom = 'Patrick';
UPDATE public.patients SET telephone = '06 92 99 90 06', telephone_normalized = '0692999006',
  adresse_ligne1 = '30 Rue des Bons-Enfants', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Lebon' AND prenom = 'Bernard';
UPDATE public.patients SET telephone = '02 62 99 90 07', telephone_normalized = '0262999007',
  adresse_ligne1 = '45 Rue du Père Lafosse', code_postal = '97432', ville = 'Ravine des Cabris'
  WHERE nom = 'Maillot' AND prenom = 'Marlène';
UPDATE public.patients SET telephone = '02 62 99 90 08', telephone_normalized = '0262999008',
  adresse_ligne1 = '18 Rue Monseigneur de Beaumont', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Payet' AND prenom = 'Marie-Ange';
UPDATE public.patients SET telephone = '02 62 99 90 09', telephone_normalized = '0262999009',
  adresse_ligne1 = '112 Rue Hubert Delisle', code_postal = '97430', ville = 'Le Tampon'
  WHERE nom = 'Robert' AND prenom = 'Anne-Sophie';
UPDATE public.patients SET telephone = '06 92 99 90 10', telephone_normalized = '0692999010',
  adresse_ligne1 = 'Bourg-Murat', code_postal = '97418', ville = 'La Plaine des Cafres'
  WHERE nom = 'Vergoz' AND prenom = 'Yves';
