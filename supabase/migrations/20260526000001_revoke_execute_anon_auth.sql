-- =============================================================================
-- Migration 06 (correctif PLAN-3) — REVOKE EXECUTE ciblé anon, authenticated
-- =============================================================================
-- La migration 20260525000001_security_advisors faisait
-- `REVOKE EXECUTE ... FROM public` sur 19 fonctions SECURITY DEFINER
-- (triggers d'audit + gardes + crons). Insuffisant : Supabase accorde des
-- GRANT EXECUTE EXPLICITES à `anon` et `authenticated` (via ses default
-- privileges), indépendants de l'héritage du rôle `public`. `REVOKE FROM
-- public` ne retire pas ces grants explicites — vérifié en prod :
-- has_function_privilege('anon'|'authenticated', ...) restait `true` après
-- 20260525000001, et les advisors SECURITY DEFINER restaient au tableau.
--
-- Ce correctif refait le REVOKE en ciblant `anon, authenticated, public`
-- sur les MÊMES 19 fonctions. Aucune régression : un trigger se déclenche
-- via le moteur de triggers (sans EXECUTE direct), un cron via pg_cron
-- (rôle postgres).
--
-- HORS périmètre (inchangé — arbitrage dirigeant Option 1, cf.
-- docs/security/RLS-AUDIT.md § 2) : les helpers RLS (has_role,
-- current_organization_id, current_user_role) et les RPC
-- (search_patients, rgpd_anonymize_patient,
-- nir_match_patient_for_legal_request) RESTENT exécutables par
-- `authenticated` — les en priver casserait toute requête authentifiée,
-- l'effacement RGPD et le portail légal.
--
-- Refs : DEC-032 (CD push exclusif), PLAN-3, migration 20260525000001.
-- =============================================================================

-- -- Triggers d'audit (13) ------------------------------------------------------
revoke execute on function public.rides_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patients_audit_trigger() from anon, authenticated, public;
revoke execute on function public.drivers_audit_trigger() from anon, authenticated, public;
revoke execute on function public.vehicles_audit_trigger() from anon, authenticated, public;
revoke execute on function public.pois_metier_audit_trigger() from anon, authenticated, public;
revoke execute on function public.driver_invitations_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patient_constraint_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patient_operational_note_audit_trigger() from anon, authenticated, public;
revoke execute on function public.patient_data_request_audit_trigger() from anon, authenticated, public;
revoke execute on function public.data_breach_incident_audit_trigger() from anon, authenticated, public;
revoke execute on function public.data_processing_register_audit_trigger() from anon, authenticated, public;
revoke execute on function public.dpa_record_audit_trigger() from anon, authenticated, public;
revoke execute on function public.dpia_record_audit_trigger() from anon, authenticated, public;

-- -- Gardes / triggers utilitaires (4) -----------------------------------------
revoke execute on function public.profiles_prevent_self_escalation() from anon, authenticated, public;
revoke execute on function public.drivers_archive_columns_dirigeant_only() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.patient_data_request_set_deadline() from anon, authenticated, public;

-- -- Fonctions de cron (2) -----------------------------------------------------
revoke execute on function public.check_breach_deadlines() from anon, authenticated, public;
revoke execute on function public.purge_legal_request_attempts() from anon, authenticated, public;
