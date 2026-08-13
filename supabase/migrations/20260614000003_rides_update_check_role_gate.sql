-- =============================================================================
-- Migration sécurité — colmatage d'une faille d'intégrité intra-org sur rides
-- =============================================================================
-- FAILLE (intégrité, PAS fuite cross-tenant) : un chauffeur pouvait réassigner
-- SA propre course à un autre chauffeur de la MÊME organisation via UPDATE
-- driver_id. Mécanisme : PostgreSQL combine en OR les WITH CHECK de TOUTES les
-- policies permissives applicables à la commande, indépendamment du USING qui a
-- sélectionné la ligne. La policy `rides_update_chauffeur_own_rides` borne bien
-- sa propre WITH CHECK (driver_id = le chauffeur), mais la policy
-- `rides_update_regulateur_dirigeant` avait une WITH CHECK limitée à
-- `organization_id` (sans contrôle de rôle). La nouvelle ligne du chauffeur
-- (même org, driver_id d'un collègue) satisfaisait donc cette WITH CHECK org-only
-- → transfert accepté.
--
-- CORRECTIF : on aligne la WITH CHECK de `rides_update_regulateur_dirigeant` sur
-- son USING (organisation ET rôle régulateur/dirigeant). Ainsi, pour un
-- chauffeur, plus AUCUNE WITH CHECK permissive n'accepte une ligne dont il
-- change le driver_id → PostgreSQL lève 42501. Les flux légitimes sont
-- préservés :
--   * régulateur/dirigeant (réassignation, validation) : rôle présent → OK ;
--   * chauffeur mettant à jour SA course (statut, started_at…) sans changer
--     driver_id : passe par la WITH CHECK de sa propre policy → OK.
-- Aucun REVOKE, aucune policy supprimée : on RESSERRE une WITH CHECK trop large.
-- =============================================================================

drop policy if exists rides_update_regulateur_dirigeant on public.rides;
create policy rides_update_regulateur_dirigeant on public.rides
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

comment on policy rides_update_regulateur_dirigeant on public.rides is
  'UPDATE course par régulateur/dirigeant de l''org. WITH CHECK alignée sur le '
  'USING (org + rôle) — DEC : empêche qu''un chauffeur détourne cette WITH CHECK '
  'org-only (combinée en OR) pour réassigner sa course à un autre driver.';
