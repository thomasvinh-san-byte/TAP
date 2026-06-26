-- =============================================================================
-- Migration — Statut `annulee` pour ride_group_status (DEC-175, fix B3)
-- =============================================================================
-- Effet de bord 12.01 (mode alerte météo) : l'annulation en lot des courses
-- (statut annulee_meteo) ignorait `ride_group_id`. Une demande groupée B2B
-- acceptée dont TOUTES les courses sont annulées pour cyclone restait `acceptee`
-- → conteneur incohérent (groupe « actif » sans aucune course active).
--
-- Nouveau statut `annulee` : groupe dont les courses ont été annulées par une
-- cause EXTERNE (météo), distinct de `refusee` (refus régulation) et `acceptee`
-- (actif). Le recalcul du statut est porté côté app (best-effort) après
-- l'annulation en lot — cf. cancelRidesBatchWeatherAction.
--
-- `ADD VALUE IF NOT EXISTS` : additif, idempotent. La valeur n'est PAS utilisée
-- dans cette migration (un nouvel enum value ne peut servir dans la même
-- transaction que son ajout) — consommée au runtime par l'app.
-- =============================================================================

alter type public.ride_group_status add value if not exists 'annulee';
