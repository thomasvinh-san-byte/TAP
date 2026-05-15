-- =============================================================================
-- Migration — Policy RLS UPDATE rides pour rôle chauffeur (Phase 04.5 T1.4)
-- =============================================================================
-- Contexte : la policy rides_update_regulateur_dirigeant (migration
-- 20260509000001_rides.sql ligne 100) restreint l'UPDATE rides aux rôles
-- regulateur et dirigeant. Conséquence : startRideAction / endRideAction
-- exécutent un UPDATE qui est silencieusement rejeté par RLS (0 rows affected)
-- côté chauffeur. Le Server Action retournait { success: true } malgré le
-- rejet → faux success affiché côté UI.
--
-- Cause root : aucune policy autorisant le chauffeur à modifier SES rides.
--
-- Fix : ajouter rides_update_chauffeur_own_rides — un chauffeur peut UPDATE
-- une ride si organization_id correspond, rôle = chauffeur, et driver_id
-- pointe vers SON enregistrement drivers (profile_id = auth.uid()).
--
-- USING et WITH CHECK identiques : empêche un chauffeur de transférer une
-- course à un autre chauffeur via UPDATE driver_id.
--
-- Scope amendement Phase 04.5 (DEC-041) : limité à rides_update + Server
-- Actions startRideAction/endRideAction. L'audit RLS systémique de toutes
-- les tables est reporté Phase 06 HDS.
-- =============================================================================

create policy rides_update_chauffeur_own_rides on public.rides
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = auth.uid()
        and archive = false
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select id from public.drivers
      where profile_id = auth.uid()
        and archive = false
    )
  );

comment on policy rides_update_chauffeur_own_rides on public.rides is
  'Phase 04.5 T1.4 — Chauffeur peut UPDATE ses propres rides (driver_id ↔ profile_id). USING + WITH CHECK identiques empêchent transfert via UPDATE driver_id.';
