-- =============================================================================
-- Fix recherche patient : pg_trgm similarity globale échouait sur queries
-- courtes (« Bègue » → similarity 0.097 < threshold 0.3).
--
-- Remplace l'opérateur `%` (similarity sur chaîne entière) par :
--   - ILIKE %q% : match substring (pattern Doctolib/Linear/Stripe)
--   - <% (word_similarity) : fallback fautes de frappe
--
-- Index gin_trgm_ops existant supporte les deux opérateurs.
-- =============================================================================

create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select lower(extensions.unaccent(q)) as qn
  )
  select p.*
  from public.patients_safe p, normalized n
  where p.organization_id = public.current_organization_id()
    and length(q) >= 2
    and (
      p.search_text ilike '%' || n.qn || '%'
      or p.search_text <% n.qn
    )
  order by
    case
      when p.search_text ilike n.qn || '%' then 0
      when p.search_text ilike '% ' || n.qn || '%' then 1
      when p.search_text ilike '%' || n.qn || '%' then 2
      else 3
    end,
    extensions.word_similarity(p.search_text, n.qn) desc,
    p.nom asc
  limit 10;
$$;

comment on function public.search_patients(text) is
  'Recherche patient ILIKE + word_similarity fallback (pattern standard SaaS).
   Remplace l''ancienne implémentation pg_trgm `%` qui échouait sur queries
   courtes (similarity globale sous threshold 0.3).';
