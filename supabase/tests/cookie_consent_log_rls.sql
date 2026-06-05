-- =============================================================================
-- Tests pgTAP — RLS cookie_consent_log (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260508000002) :
--   - service_role ONLY (INSERT + SELECT).
--   - revoke all from authenticated, anon.
--   - Pas d'organization_id : bandeau cookies CNIL anonyme possible.
-- =============================================================================

begin;

select plan(4);

-- 1. RLS activée + forcée
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.cookie_consent_log'::regclass),
  'RLS activée + forcée sur cookie_consent_log'
);

-- 2. authenticated n'a AUCUN privilège (SELECT/INSERT/UPDATE/DELETE)
select ok(
  not has_table_privilege('authenticated', 'public.cookie_consent_log', 'SELECT')
    and not has_table_privilege('authenticated', 'public.cookie_consent_log', 'INSERT')
    and not has_table_privilege('authenticated', 'public.cookie_consent_log', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.cookie_consent_log', 'DELETE'),
  'authenticated refusé sur cookie_consent_log (service_role only)'
);

-- 3. anon refusé
select ok(
  not has_table_privilege('anon', 'public.cookie_consent_log', 'SELECT')
    and not has_table_privilege('anon', 'public.cookie_consent_log', 'INSERT'),
  'anon refusé sur cookie_consent_log'
);

-- 4. service_role peut INSERT + SELECT (granted explicitly via policies + grants)
-- Note : pas de grant explicit dans la migration ; service_role bypass RLS
-- via SUPABASE_SERVICE_ROLE_KEY (Phase 1.5 D-14). Vérifier que les policies
-- existent bien.
select ok(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'cookie_consent_log'
     and roles @> array['service_role']) >= 2,
  'policies service_role INSERT + SELECT existent'
);

select * from finish();
rollback;
