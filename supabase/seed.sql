-- =============================================================================
-- Seed — Données de démonstration locales uniquement
-- =============================================================================
-- Crée 1 organization de démo + 3 comptes (dirigeant, régulateur, chauffeur).
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
-- Comptes Auth + profils
-- -----------------------------------------------------------------------------
-- Mot de passe : demo1234! (haché bcrypt côté Supabase Auth via gotrue)
-- L'INSERT direct dans auth.users avec encrypted_password est volontairement
-- limité au contexte local. En staging/prod : invitation via service_role.
-- -----------------------------------------------------------------------------

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  dirigeant_id uuid := '00000000-0000-0000-0000-000000000010';
  regulateur_id uuid := '00000000-0000-0000-0000-000000000020';
  chauffeur_id uuid := '00000000-0000-0000-0000-000000000030';
  hashed text := crypt('demo1234!', gen_salt('bf'));
begin
  -- Dirigeant
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  values (
    dirigeant_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'dirigeant@demo.tap', hashed,
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', 'Patrick', 'nom', 'Hoarau')
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (dirigeant_id, org_id, 'dirigeant', 'Patrick', 'Hoarau', 'dirigeant@demo.tap')
  on conflict (id) do nothing;

  -- Régulateur
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  values (
    regulateur_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'regulateur@demo.tap', hashed,
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', 'Sandrine', 'nom', 'Payet')
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (regulateur_id, org_id, 'regulateur', 'Sandrine', 'Payet', 'regulateur@demo.tap')
  on conflict (id) do nothing;

  -- Chauffeur
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  values (
    chauffeur_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'chauffeur@demo.tap', hashed,
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', 'Jean-Marc', 'nom', 'Técher')
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (chauffeur_id, org_id, 'chauffeur', 'Jean-Marc', 'Técher', 'chauffeur@demo.tap')
  on conflict (id) do nothing;
end
$$;

-- -----------------------------------------------------------------------------
-- Compte E2E (PLAN-1 helper loginAsRegulateur attend reg-demo@tap.test)
-- -----------------------------------------------------------------------------
do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  e2e_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  hashed text := crypt('demo1234!', gen_salt('bf'));
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  values (
    e2e_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'reg-demo@tap.test', hashed,
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', 'E2E', 'nom', 'Régulatrice')
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (e2e_id, org_id, 'regulateur', 'E2E', 'Régulatrice', 'reg-demo@tap.test')
  on conflict (id) do nothing;
end
$$;
