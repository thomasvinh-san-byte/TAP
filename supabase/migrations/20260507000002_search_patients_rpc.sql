-- =============================================================================
-- Migration 004 — RPC search_patients (recherche fuzzy patient)
-- =============================================================================
-- Crée la fonction RPC public.search_patients(q text) qui retourne
-- setof public.patients_safe (et NON pas la table brute) pour éviter toute
-- fuite de ciphertext NIR (B-5). Consommée par PLAN-5 (UI patient).
--
-- Garanties :
--   - SECURITY = INVOKER (RLS de patients via la vue patients_safe s'applique
--     à l'appelant, pas au propriétaire de la fonction)
--   - filtre length d'au moins 2 côté SQL (court-circuit si l'UI envoie 1 char)
--   - lower(unaccent(q)) aligne strictement avec la colonne générée
--     search_text (cf. migration 003 section 3)
--   - cap dur à 10 résultats (ranking client sur 10 max)
--   - revoke all + grant execute only to authenticated (anon ne peut pas
--     appeler la fonction)
-- =============================================================================

create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select *
  from public.patients_safe
  where organization_id = public.current_organization_id()
    and length(q) >= 2
    and search_text % lower(extensions.unaccent(q))
  order by extensions.similarity(
    search_text, lower(extensions.unaccent(q))
  ) desc
  limit 10;
$$;

comment on function public.search_patients(text) is
  'Recherche fuzzy patient (pg_trgm). Retourne setof patients_safe — masque
le ciphertext NIR. RLS héritée via SECURITY = INVOKER.';

revoke all on function public.search_patients(text) from public;
grant execute on function public.search_patients(text) to authenticated;
