-- =============================================================================
-- Hotfix régression PR #101 — SECURITY DEFINER restauré (2026-05-18)
-- =============================================================================
-- La migration 20260516000006 a remplacé security definer par security invoker
-- sur current_organization_id() ET current_user_role(), provoquant une
-- récursion infinie RLS sur les policies de profiles (et toutes les tables qui
-- wrappent ces fonctions dans leurs policies).
--
-- Mécanique de la régression :
--   1. App fait SELECT * FROM profiles WHERE id = user_id
--   2. Postgres applique RLS policy profiles_select_same_org :
--      organization_id = current_organization_id()
--   3. current_organization_id() (security invoker) SELECT depuis profiles
--   4. Postgres applique RLS sur cette nouvelle requête profiles
--   5. Récursion infinie → stack overflow Postgres → 500
--
-- Résultat observé : erreurs 500 systématiques sur GET /profiles,
-- /patients_safe, /rides, etc. → boucle middleware Next.js côté app →
-- boucle redirect client → "Too many calls to Location or History APIs"
-- Firefox.
--
-- Fix : restaurer SECURITY DEFINER (comme foundations.sql original),
-- en PRÉSERVANT le wrapping interne (SELECT auth.uid()) pour le bénéfice
-- initPlan PostgreSQL apporté par PR #101.
--
-- Sources :
--   - foundations.sql ligne 125-126 commentaire explicite :
--     « SECURITY DEFINER permet de lire profiles sans déclencher
--       les policies récursivement. »
--   - PostgreSQL docs SECURITY DEFINER bypass RLS
--
-- Refs : DEC-032 (CD push exclusif), DEC-041 N/A.
-- =============================================================================

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid())
    and actif is true
  limit 1;
$$;

comment on function public.current_organization_id() is
  'organization_id du profil rattaché à auth.uid(). NULL si non authentifié ou inactif. SECURITY DEFINER = bypass RLS récursion (cf hotfix 2026-05-18). Wrapping (SELECT auth.uid()) interne préservé pour initPlan.';

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and actif is true
  limit 1;
$$;

comment on function public.current_user_role() is
  'Rôle du profil rattaché à auth.uid(). NULL si non auth/inactif. SECURITY DEFINER = bypass RLS (cf hotfix 2026-05-18).';
