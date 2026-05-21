-- =============================================================================
-- Migration 06 PLAN-3 — Correctifs advisors sécurité Supabase
-- =============================================================================
-- Audit sécurité Phase 06 (Bloc E.1). Voir docs/security/RLS-AUDIT.md.
--
-- Traite :
--   1. function_search_path_mutable (3) — fige le search_path.
--   2. SECURITY DEFINER exécutables par anon/authenticated — REVOKE de
--      l'EXECUTE public sur les fonctions JAMAIS appelées par un client
--      (triggers + fonctions de cron). Un trigger s'exécute via le moteur
--      de triggers, pas par appel direct : retirer l'EXECUTE public ne
--      l'empêche pas de se déclencher.
--
-- HORS périmètre (décision dirigeant — arbitrage 2026-05-21) :
--   - Les helpers RLS (has_role, current_organization_id, current_user_role)
--     et les RPC (search_patients, rgpd_anonymize_patient,
--     nir_match_patient_for_legal_request) RESTENT exécutables par
--     authenticated : les expressions de policy RLS et les appels `.rpc()`
--     de l'app les requièrent. Les révoquer casserait toute requête
--     authentifiée + l'effacement RGPD + le portail légal. L'advisor
--     « SECURITY DEFINER exécutable par authenticated » est, pour ces
--     fonctions, attendu par conception (cf. RLS-AUDIT.md § tri).
--   - extension_in_public (pg_net) : déplacement différé — pg_net est
--     dormant (crons SMS en pause, ADR-004) ; le déplacer maintenant
--     risquerait le rejeu de la chaîne de migrations sans bénéfice runtime.
--     À traiter au rebranchement SMS. Documenté RLS-AUDIT.md.
--   - leaked_password_protection : réglage console (Auth → Settings),
--     non automatisable en SQL. Action dirigeant — cf. RLS-AUDIT.md.
--
-- Refs : DEC-032 (CD push exclusif), PLAN-3, CLAUDE.md § 6.
-- =============================================================================

-- -- Section 1 — function_search_path_mutable -----------------------------------
-- Fige le search_path des 3 fonctions signalées (un search_path mutable est
-- une surface d'attaque : résolution d'objet détournable).
alter function public.set_updated_at()
  set search_path = public, extensions;

alter function public.unaccent_immutable(text)
  set search_path = public, extensions;

alter function public.patient_data_request_set_deadline()
  set search_path = public, extensions;

-- -- Section 2 — REVOKE EXECUTE des SECURITY DEFINER non appelables client ------
-- Fonctions de trigger d'audit : invoquées par le moteur de triggers, jamais
-- en appel direct. Le REVOKE de l'EXECUTE public n'empêche pas le trigger de
-- se déclencher (les tests pgTAP rides_audit.sql etc. le prouvent en CI).
revoke execute on function public.rides_audit_trigger() from public;
revoke execute on function public.patients_audit_trigger() from public;
revoke execute on function public.drivers_audit_trigger() from public;
revoke execute on function public.vehicles_audit_trigger() from public;
revoke execute on function public.pois_metier_audit_trigger() from public;
revoke execute on function public.driver_invitations_audit_trigger() from public;
revoke execute on function public.patient_constraint_audit_trigger() from public;
revoke execute on function public.patient_operational_note_audit_trigger() from public;
revoke execute on function public.patient_data_request_audit_trigger() from public;
revoke execute on function public.data_breach_incident_audit_trigger() from public;
revoke execute on function public.data_processing_register_audit_trigger() from public;
revoke execute on function public.dpa_record_audit_trigger() from public;
revoke execute on function public.dpia_record_audit_trigger() from public;

-- Fonctions de trigger de garde / utilitaires : idem, invoquées par triggers.
revoke execute on function public.profiles_prevent_self_escalation() from public;
revoke execute on function public.drivers_archive_columns_dirigeant_only() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.patient_data_request_set_deadline() from public;

-- Fonctions de cron : invoquées par pg_cron (rôle postgres), jamais par un
-- client. REVOKE de l'EXECUTE public sans impact sur l'ordonnancement.
revoke execute on function public.check_breach_deadlines() from public;
revoke execute on function public.purge_legal_request_attempts() from public;
