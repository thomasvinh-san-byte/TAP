-- =============================================================================
-- Tests pgTAP — RLS legal_request_attempts (Phase 06.21)
-- =============================================================================
-- Policies (migration 20260508000002) :
--   - service_role ALL (using true + with check true).
--   - revoke all from authenticated, anon.
--   - Rate limit portail patient — D-20 (Server Action only).
-- =============================================================================

begin;

select plan(3);

-- 1. RLS activée + forcée
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.legal_request_attempts'::regclass),
  'RLS activée + forcée sur legal_request_attempts'
);

-- 2. authenticated et anon refusés sur tout
select ok(
  not has_table_privilege('authenticated', 'public.legal_request_attempts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.legal_request_attempts', 'INSERT')
    and not has_table_privilege('anon', 'public.legal_request_attempts', 'SELECT')
    and not has_table_privilege('anon', 'public.legal_request_attempts', 'INSERT'),
  'authenticated + anon refusés sur legal_request_attempts (service_role only)'
);

-- 3. Policy ALL service_role existe
select ok(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'legal_request_attempts'
     and roles @> array['service_role']::name[]) >= 1,
  'policy service_role existe'
);

select * from finish();
rollback;
