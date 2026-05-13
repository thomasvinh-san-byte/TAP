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
insert into public.organizations (id, nom, siret, ville, code_postal, telephone, email)
values (
  '00000000-0000-0000-0000-000000000001',
  'TAP Démo Réunion',
  '12345678901234',
  'Saint-Denis',
  '97400',
  '0262000000',
  'contact@demo.tap'
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
end
$$;

-- -----------------------------------------------------------------------------
-- Re-seed patients fictifs — défense en profondeur NFR-001 (D-SEED-1..4)
-- -----------------------------------------------------------------------------
-- Données fictives — pattern numéro 9XXX + tél 99-90-XX, aucune
-- correspondance volontaire avec personnes réelles. Bloc UPDATE idempotent
-- mirroir de la migration 20260513000003. No-op si les patients démo ne
-- sont pas encore semés (seed.sql s'exécute avant seed.demo.sql) ; sinon
-- réaligne sur les valeurs canoniques. Les noms sont conservés (exception
-- NFR-001 explicite pour les données de démo, Q3 phase 03.1).
-- -----------------------------------------------------------------------------

UPDATE public.patients SET telephone = '02 62 99 90 01', telephone_normalized = '0262999001',
  adresse_ligne1 = '9001 chemin du Vacoa', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Bègue' AND prenom = 'Christiane';
UPDATE public.patients SET telephone = '02 62 99 90 02', telephone_normalized = '0262999002',
  adresse_ligne1 = '9002 rue des Lataniers', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Boyer' AND prenom = 'Suzanne';
UPDATE public.patients SET telephone = '06 92 99 90 03', telephone_normalized = '0692999003',
  adresse_ligne1 = '9003 allée des Songes', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Dijoux' AND prenom = 'André';
UPDATE public.patients SET telephone = '06 92 99 90 04', telephone_normalized = '0692999004',
  adresse_ligne1 = '9004 chemin du Piton', code_postal = '97490', ville = 'Sainte-Clotilde'
  WHERE nom = 'Grondin' AND prenom = 'Jean-Bernard';
UPDATE public.patients SET telephone = '06 92 99 90 05', telephone_normalized = '0692999005',
  adresse_ligne1 = '9005 rue des Bambous', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Hoarau' AND prenom = 'Patrick';
UPDATE public.patients SET telephone = '06 92 99 90 06', telephone_normalized = '0692999006',
  adresse_ligne1 = '9006 chemin de la Ravine', code_postal = '97410', ville = 'Saint-Pierre'
  WHERE nom = 'Lebon' AND prenom = 'Bernard';
UPDATE public.patients SET telephone = '02 62 99 90 07', telephone_normalized = '0262999007',
  adresse_ligne1 = '9007 rue des Cyclones', code_postal = '97432', ville = 'Ravine des Cabris'
  WHERE nom = 'Maillot' AND prenom = 'Marlène';
UPDATE public.patients SET telephone = '02 62 99 90 08', telephone_normalized = '0262999008',
  adresse_ligne1 = '9008 allée du Volcan', code_postal = '97400', ville = 'Saint-Denis'
  WHERE nom = 'Payet' AND prenom = 'Marie-Ange';
UPDATE public.patients SET telephone = '02 62 99 90 09', telephone_normalized = '0262999009',
  adresse_ligne1 = '9009 chemin du Lagon', code_postal = '97430', ville = 'Le Tampon'
  WHERE nom = 'Robert' AND prenom = 'Anne-Sophie';
UPDATE public.patients SET telephone = '06 92 99 90 10', telephone_normalized = '0692999010',
  adresse_ligne1 = '9010 rue des Galets', code_postal = '97418', ville = 'La Plaine des Cafres'
  WHERE nom = 'Vergoz' AND prenom = 'Yves';
