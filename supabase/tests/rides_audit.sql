-- =============================================================================
-- pgTAP — Audit trigger rides (Phase 2, Plan 02-01, Wave 0 RED scaffold)
-- =============================================================================
-- Couvrira en Wave 1 (D-10 + pattern Phase 1 patients_audit_trigger) :
--   - INSERT public.rides → audit_logs.action='ride.insert'
--   - UPDATE public.rides → audit_logs.action='ride.update'
--   - DELETE public.rides → audit_logs.action='ride.delete'
--   - metadata->'new' contient patient_id + scheduled_at
--   - PAS de trigger sur public.ride_draft (donnée transitoire)
--   - actor_id = auth.uid(), entity_type='ride', entity_id=rides.id
-- Wave 0 : plan(0) — la table public.rides et le trigger
-- public.rides_audit_trigger n'existent pas encore.
-- =============================================================================
begin;

select plan(0);

-- TODO Wave 1 : assertions calquées sur supabase/tests/patients.sql
-- lignes 195-218 (audit_logs queries) avec action_name='ride.insert'.

select * from finish();
rollback;
