-- =============================================================================
-- Tests pgTAP — Correctifs advisors sécurité (Phase 06 PLAN-3)
-- =============================================================================
-- Vérifie la migration 20260525000001_security_advisors :
--   - search_path figé sur les 3 fonctions signalées
--   - EXECUTE révoqué sur les fonctions de trigger / cron (non appelables
--     client)
--   - les helpers RLS restent exécutables par `authenticated` — PREUVE que
--     le RLS n'est pas cassé (cf. RLS-AUDIT.md, arbitrage périmètre sûr)
--
-- Les fonctions de trigger continuent de se déclencher : prouvé en CI par
-- les tests d'audit existants (rides_audit.sql, etc.).
-- =============================================================================

begin;

select plan(11);

-- -----------------------------------------------------------------------------
-- 1. search_path figé (function_search_path_mutable résolu)
-- -----------------------------------------------------------------------------
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
   where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace)
  like '%search_path%',
  'set_updated_at a un search_path figé'
);
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
   where proname = 'unaccent_immutable' and pronamespace = 'public'::regnamespace)
  like '%search_path%',
  'unaccent_immutable a un search_path figé'
);
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
   where proname = 'patient_data_request_set_deadline'
     and pronamespace = 'public'::regnamespace)
  like '%search_path%',
  'patient_data_request_set_deadline a un search_path figé'
);

-- -----------------------------------------------------------------------------
-- 2. EXECUTE révoqué sur les fonctions de trigger / cron
-- -----------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.rides_audit_trigger()', 'execute'),
  'anon ne peut pas EXECUTE rides_audit_trigger (trigger d audit)'
);
select ok(
  not has_function_privilege('authenticated', 'public.drivers_audit_trigger()', 'execute'),
  'authenticated ne peut pas EXECUTE drivers_audit_trigger'
);
select ok(
  not has_function_privilege('anon', 'public.profiles_prevent_self_escalation()', 'execute'),
  'anon ne peut pas EXECUTE profiles_prevent_self_escalation (garde)'
);
select ok(
  not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'authenticated ne peut pas EXECUTE set_updated_at (trigger utilitaire)'
);
select ok(
  not has_function_privilege('anon', 'public.check_breach_deadlines()', 'execute'),
  'anon ne peut pas EXECUTE check_breach_deadlines (cron)'
);

-- -----------------------------------------------------------------------------
-- 3. Helpers RLS TOUJOURS exécutables — preuve que le RLS reste intact
-- -----------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.current_organization_id()', 'execute'),
  'authenticated peut toujours EXECUTE current_organization_id (policies OK)'
);
select ok(
  has_function_privilege('authenticated', 'public.current_user_role()', 'execute'),
  'authenticated peut toujours EXECUTE current_user_role (policies OK)'
);
select ok(
  has_function_privilege('authenticated', 'public.has_role(public.user_role)', 'execute'),
  'authenticated peut toujours EXECUTE has_role (policies OK)'
);

select * from finish();
rollback;
