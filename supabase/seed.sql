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
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    p_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('prenom', p_prenom, 'nom', p_nom)
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
  values (p_user_id, p_org_id, p_role, p_prenom, p_nom, p_email)
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
    org_id, 'dirigeant', 'Patrick', 'Hoarau'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000020',
    'regulateur@demo.tap', 'demo1234!',
    org_id, 'regulateur', 'Sandrine', 'Payet'
  );
  perform pg_temp.seed_demo_user(
    '00000000-0000-0000-0000-000000000030',
    'chauffeur@demo.tap', 'demo1234!',
    org_id, 'chauffeur', 'Jean-Marc', 'Técher'
  );
  -- Compte E2E (PLAN-1 helper loginAsRegulateur attend reg-demo@tap.test)
  perform pg_temp.seed_demo_user(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'reg-demo@tap.test', 'demo1234!',
    org_id, 'regulateur', 'E2E', 'Régulatrice'
  );
end
$$;
