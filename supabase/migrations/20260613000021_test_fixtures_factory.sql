-- =============================================================================
-- Fabrique de préambule pour les tests de base de données (pgTAP)
-- =============================================================================
-- Factorise le socle d'authentification recopié dans ~46 tests pgTAP : deux
-- organisations de référence + utilisateurs par rôle + profils, avec des
-- IDENTIFIANTS FIGÉS (les tests endossent une identité précise via
-- `set request.jwt.claim.sub = '<id>'`). Chaque test appelle
-- `test_fixtures.setup(...)` au début de sa transaction (annulée en fin de test)
-- au lieu de recopier le préambule.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SÉCURITÉ — INERTE ET INACCESSIBLE EN PRODUCTION (condition d'acceptation)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cette migration est poussée par le déploiement à TOUS les environnements liés
-- (production comprise). Les fonctions de fixtures y sont donc présentes, mais
-- rendues STRICTEMENT INERTES hors contexte de test, par trois garde-fous
-- CUMULATIFS :
--
--   1. SCHÉMA DÉDIÉ `test_fixtures` — distinct du schéma applicatif `public`,
--      pour ne pas polluer la surface applicative.
--   2. AUCUN OCTROI aux rôles applicatifs — USAGE sur le schéma et EXECUTE sur
--      les fonctions sont révoqués à `public`, `anon` et `authenticated`. Seuls
--      les rôles d'administration/test (superuser / propriétaire) peuvent
--      appeler la fabrique.
--   3. GARDE D'EXÉCUTION — `setup()` REFUSE de s'exécuter si l'extension `pgtap`
--      est absente. `pgtap` n'est présente QUE sous `supabase test db` (aucune
--      migration ne l'installe → absente en production). Appelée par erreur en
--      production, la fonction ne crée RIEN et échoue explicitement.
--
-- La fabrique n'est ni un objet applicatif ni une donnée : c'est de l'outillage
-- de test. Elle ne modifie pas le schéma métier et n'accorde aucun privilège.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- IDENTIFIANTS DE RÉFÉRENCE FIGÉS (endossables via request.jwt.claim.sub)
-- ─────────────────────────────────────────────────────────────────────────────
--   Org Alpha (principale) : 11111111-1111-1111-1111-111111111111
--   Org Bravo (isolation)  : 22222222-2222-2222-2222-222222222222
--   alpha-dirigeant  : aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   alpha-regulateur : cccccccc-cccc-cccc-cccc-cccccccccccc
--   alpha-chauffeur  : ffffffff-ffff-ffff-ffff-ffffffffffff
--   bravo (org Bravo, dirigeant OU regulateur selon second_org_role)
--                    : dddddddd-dddd-dddd-dddd-dddddddddddd
--
-- Variantes (mesurées sur les tests) : seconde organisation (33 tests) et
-- chauffeur (17 tests). Toggles supplémentaires pour couvrir fidèlement les
-- socles à un seul rôle Alpha, sans jamais changer un identifiant figé.
-- =============================================================================

create schema if not exists test_fixtures;

comment on schema test_fixtures is
  'Outillage de FIXTURES DE TEST uniquement (préambule pgTAP factorisé). '
  'Inerte hors test : aucun octroi aux roles applicatifs + garde pgtab dans setup(). '
  'Ne JAMAIS accorder USAGE/EXECUTE a anon/authenticated.';

-- Garde-fou 2 : personne d'applicatif ne peut voir ni appeler le schéma.
revoke all on schema test_fixtures from public;
revoke usage on schema test_fixtures from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Interne : crée un utilisateur Auth + son profil (identifiants figés).
-- Centralise la cohérence avec le schéma d'authentification (colonnes requises).
-- SECURITY INVOKER : s'exécute avec les droits de l'appelant (le lanceur de
-- test, superuser → contourne la RLS comme le faisait le préambule recopié).
-- -----------------------------------------------------------------------------
create or replace function test_fixtures._create_user(
  p_id uuid,
  p_org uuid,
  p_role public.user_role,
  p_prenom text,
  p_nom text,
  p_email text
) returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, extensions.crypt('test1234!', extensions.gen_salt('bf')),
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, role, prenom, nom, email)
  values (p_id, p_org, p_role, p_prenom, p_nom, p_email)
  on conflict (id) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Interne : construit le socle (SANS la garde). Non destiné à l'appel direct.
-- -----------------------------------------------------------------------------
create or replace function test_fixtures._build(
  with_second_org boolean,
  second_org_role text,
  with_chauffeur boolean,
  with_alpha_dirigeant boolean,
  with_alpha_regulateur boolean
) returns void
language plpgsql
set search_path = ''
as $$
declare
  org_alpha constant uuid := '11111111-1111-1111-1111-111111111111';
  org_bravo constant uuid := '22222222-2222-2222-2222-222222222222';
begin
  if second_org_role not in ('dirigeant', 'regulateur') then
    raise exception 'test_fixtures: second_org_role invalide (%). Attendu dirigeant|regulateur.', second_org_role;
  end if;

  insert into public.organizations (id, nom, ville, code_postal)
  values (org_alpha, 'Org Alpha', 'Saint-Denis', '97400')
  on conflict (id) do nothing;

  if with_second_org then
    insert into public.organizations (id, nom, ville, code_postal)
    values (org_bravo, 'Org Bravo', 'Saint-Pierre', '97410')
    on conflict (id) do nothing;
  end if;

  if with_alpha_dirigeant then
    perform test_fixtures._create_user(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', org_alpha, 'dirigeant',
      'Alpha', 'Dirigeant', 'alpha-dir@test.tap');
  end if;

  if with_alpha_regulateur then
    perform test_fixtures._create_user(
      'cccccccc-cccc-cccc-cccc-cccccccccccc', org_alpha, 'regulateur',
      'Alpha', 'Régulateur', 'alpha-reg@test.tap');
  end if;

  if with_chauffeur then
    perform test_fixtures._create_user(
      'ffffffff-ffff-ffff-ffff-ffffffffffff', org_alpha, 'chauffeur',
      'Alpha', 'Chauffeur', 'alpha-chauffeur@test.tap');
  end if;

  if with_second_org then
    if second_org_role = 'dirigeant' then
      perform test_fixtures._create_user(
        'dddddddd-dddd-dddd-dddd-dddddddddddd', org_bravo, 'dirigeant',
        'Bravo', 'Dirigeant', 'bravo-dir@test.tap');
    else
      perform test_fixtures._create_user(
        'dddddddd-dddd-dddd-dddd-dddddddddddd', org_bravo, 'regulateur',
        'Bravo', 'Régulateur', 'bravo-reg@test.tap');
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- API publique de la fabrique : installe le socle demandé.
-- Socle par défaut = Org Alpha + alpha-dirigeant + alpha-regulateur.
-- Options : seconde organisation (+ rôle du user Bravo), chauffeur Alpha,
-- et suppression d'un rôle Alpha (pour les socles à un seul rôle).
-- -----------------------------------------------------------------------------
create or replace function test_fixtures.setup(
  with_second_org boolean default false,
  second_org_role text default 'dirigeant',
  with_chauffeur boolean default false,
  with_alpha_dirigeant boolean default true,
  with_alpha_regulateur boolean default true
) returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Garde-fou 3 : refuse hors contexte de test (pgtap absent = production).
  if not exists (select 1 from pg_extension where extname = 'pgtap') then
    raise exception
      'test_fixtures.setup() est reserve au contexte de test (extension pgtap absente) — inerte en production'
      using errcode = 'insufficient_privilege';
  end if;

  perform test_fixtures._build(
    with_second_org, second_org_role, with_chauffeur,
    with_alpha_dirigeant, with_alpha_regulateur);
end;
$$;

comment on function test_fixtures.setup(boolean, text, boolean, boolean, boolean) is
  'Fabrique de preambule des tests pgTAP. Installe Org Alpha + alpha-dir/reg (+ '
  'options : seconde org, chauffeur, toggles de role Alpha). Identifiants figes. '
  'INERTE hors test (garde pgtap). Ne pas octroyer a anon/authenticated.';

-- Garde-fou 2 (fonctions) : révoquer EXECUTE aux rôles applicatifs. Aucune
-- fonction de ce schéma n'est appelable par anon/authenticated.
revoke all on function test_fixtures._create_user(uuid, uuid, public.user_role, text, text, text) from public;
revoke all on function test_fixtures._build(boolean, text, boolean, boolean, boolean) from public;
revoke all on function test_fixtures.setup(boolean, text, boolean, boolean, boolean) from public;
revoke all on function test_fixtures._create_user(uuid, uuid, public.user_role, text, text, text) from anon, authenticated;
revoke all on function test_fixtures._build(boolean, text, boolean, boolean, boolean) from anon, authenticated;
revoke all on function test_fixtures.setup(boolean, text, boolean, boolean, boolean) from anon, authenticated;
