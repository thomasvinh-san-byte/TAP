-- =============================================================================
-- Tests pgTAP — RLS / grants / index de public.login_attempts
-- =============================================================================
-- Durcissement connexion (migration 20260613000022). Calqué sur
-- legal_request_attempts_rls.sql :
--   - RLS activée + forcée ;
--   - authenticated + anon refusés sur tout (service_role only) ;
--   - policy ALL service_role présente ;
--   - index de fenêtre glissante par compte ET par origine présents.
-- =============================================================================

begin;

select plan(4);

-- 1. RLS activée + forcée
select ok(
  (select relrowsecurity and relforcerowsecurity
     from pg_class where oid = 'public.login_attempts'::regclass),
  'RLS activée + forcée sur login_attempts'
);

-- 2. authenticated et anon refusés sur tout (aucune lecture ni écriture)
select ok(
  not has_table_privilege('authenticated', 'public.login_attempts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.login_attempts', 'INSERT')
    and not has_table_privilege('anon', 'public.login_attempts', 'SELECT')
    and not has_table_privilege('anon', 'public.login_attempts', 'INSERT'),
  'authenticated + anon refusés sur login_attempts (service_role only)'
);

-- 3. Policy ALL service_role existe
select ok(
  (select count(*)::int from pg_policies
     where schemaname = 'public' and tablename = 'login_attempts'
       and roles @> array['service_role']) >= 1,
  'policy service_role existe sur login_attempts'
);

-- 4. Index de fenêtre glissante présents (par compte ET par origine)
select ok(
  exists (select 1 from pg_indexes
            where schemaname = 'public' and tablename = 'login_attempts'
              and indexname = 'login_attempts_identifier_time_idx')
  and exists (select 1 from pg_indexes
                where schemaname = 'public' and tablename = 'login_attempts'
                  and indexname = 'login_attempts_ip_time_idx'),
  'index (identifier_hash, attempted_at desc) ET (ip_hash, attempted_at desc) présents'
);

select * from finish();
rollback;
